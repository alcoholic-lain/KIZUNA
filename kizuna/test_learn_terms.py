"""Learning rewards (whitelist, pass mark, once only) and terms and conditions consent."""
import json

from django.test import TestCase

from kizuna import terms
from m11.seed import reset_demo
from m12.models import LearningProgress, Profile, TokenTx


class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def post(self, url, data=None):
        return self.client.post(url, data=json.dumps(data or {}), content_type="application/json")

    def demo(self, role="foyer"):
        self.assertEqual(self.post("/api/auth/demo", {"role": role}).status_code, 200)


class LearnTests(Base):
    def test_unknown_activity_pays_nothing(self):
        self.demo()
        before = TokenTx.objects.filter(kind="education").count()
        r = self.post("/api/learn/complete", {"item": "farm-1", "score": 100})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(TokenTx.objects.filter(kind="education").count(), before)

    def test_failing_score_pays_nothing_and_is_not_recorded(self):
        self.demo()
        r = self.post("/api/learn/complete", {"item": "quiz-facture", "score": 20}).json()
        self.assertFalse(r["passed"])
        self.assertEqual(r["tokens"], 0)
        self.assertFalse(LearningProgress.objects.filter(item="quiz-facture").exists())

    def test_pays_once_then_keeps_best_score(self):
        self.demo()
        first = self.post("/api/learn/complete", {"item": "quiz-habitudes", "score": 60}).json()
        self.assertTrue(first["passed"])
        self.assertGreaterEqual(first["tokens"], 0)
        again = self.post("/api/learn/complete", {"item": "quiz-habitudes", "score": 100}).json()
        self.assertEqual(again["tokens"], 0)
        self.assertEqual(LearningProgress.objects.get(item="quiz-habitudes", user__profile__role="foyer").score, 100)
        self.assertEqual(sum(1 for i in again["items"] if i["done"]), len(again["done"]))

    def test_progress_lists_every_activity(self):
        self.demo()
        data = self.client.get("/api/learn").json()
        self.assertEqual({i["id"] for i in data["items"]}, {"jeu-vampires", "quiz-energie", "quiz-facture", "quiz-habitudes", "quiz-maison"})

    def test_bill_simulator_follows_the_tariff(self):
        small = self.client.get("/api/learn/bill?kwh=100&kva=4").json()
        big = self.client.get("/api/learn/bill?kwh=400&kva=4").json()
        self.assertGreater(big["total"], small["total"])
        self.assertGreater(big["band_price"], small["band_price"])
        self.assertEqual(big["bands"][-1]["upto"], None)
        self.assertEqual(small["next"]["at"], 100)  # crossing 100 kWh reprices every kWh
        self.assertGreater(small["next"]["jump"], 0)
        self.assertIsNone(self.client.get("/api/learn/bill?kwh=600&kva=4").json()["next"])
        self.assertEqual(self.client.get("/api/learn/bill?kwh=abc").status_code, 400)


class TermsTests(Base):
    def test_terms_text_is_public(self):
        data = self.client.get("/api/terms").json()
        self.assertEqual(data["version"], terms.VERSION)
        self.assertTrue(data["sections"])

    def test_registration_requires_consent(self):
        body = {"name": "Nour", "email": "nour@example.tn", "password": "longpassword1"}
        r = self.post("/api/auth/register", body)
        self.assertEqual(r.status_code, 400)
        self.assertIn("terms", r.json()["fields"])
        r = self.post("/api/auth/register", {**body, "accept_terms": True})
        self.assertEqual(r.status_code, 200)
        t = r.json()["user"]["terms"]
        self.assertTrue(t["ok"])
        self.assertEqual(t["version"], terms.VERSION)
        self.assertTrue(t["accepted_at"])

    def test_profile_cannot_be_saved_without_accepting_then_remembers(self):
        self.demo()
        Profile.objects.filter(user__profile__role="foyer", is_demo=True).update(terms_version="", terms_accepted_at=None)
        me = self.client.get("/api/auth/me").json()["user"]
        self.assertFalse(me["terms"]["ok"])
        r = self.post("/api/profile", {"name": "Amira", "goal": 150})
        self.assertEqual(r.status_code, 400)
        r = self.post("/api/profile", {"name": "Amira", "goal": 150, "accept_terms": True})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["user"]["terms"]["ok"])
        self.assertEqual(r.json()["user"]["household"]["goal"], 150)
        self.assertEqual(self.post("/api/profile", {"goal": 160}).status_code, 200)  # already accepted

    def test_an_older_version_must_be_accepted_again(self):
        self.demo()
        Profile.objects.filter(is_demo=True, role="foyer").update(terms_version="1999-01", terms_accepted_at=None)
        self.assertEqual(self.post("/api/profile", {"goal": 150}).status_code, 400)
