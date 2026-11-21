from django.contrib import admin

from . import models

for model in (models.Region, models.Building, models.Household, models.Profile, models.Adapter, models.Installation,
              models.Event, models.Reading, models.Alert, models.SavingAction, models.TokenTx, models.SolidarityProject,
              models.Contribution, models.SimState):
    admin.site.register(model)
