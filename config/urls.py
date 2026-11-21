"""Project URLs: JSON API, admin, module shortcuts and the React app."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/', include('config.api_urls')),
    path('m1/', include('m1.urls')),
    path('m2/', include('m2.urls')),
    path('m3/', include('m3.urls')),
    path('m4/', include('m4.urls')),
    path('m5/', include('m5.urls')),
    path('m10/', include('m10.urls')),
    path('m11/', include('m11.urls')),
    path('m12/', include('m12.urls')),
    path('m13/', include('m13.urls')),
    path('m14/', include('m14.urls')),
    path('m15/', include('m15.urls')),
    path('', include('kizuna.urls')),
]
