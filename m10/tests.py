from django.test import TestCase
from django.urls import reverse


class PlaceholderTests(TestCase):
    def test_index_renders(self):
        response = self.client.get(reverse("m10:index"))
        self.assertContains(response, "M10")
