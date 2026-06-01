from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.federated.views import FLMaintenanceStatusView

urlpatterns = [
    path('admin/', admin.site.urls),

    # App APIs
    path('api/auth/', include('apps.auth_app.urls')),
    path('api/hospital/', include('apps.hospital.urls')),
    path('api/patient/', include('apps.patient.urls')),
    path('api/doctor/', include('apps.doctor.urls')),
    path('api/pharmacy/', include('apps.pharmacy.urls')),
    path('api/lab/', include('apps.lab.urls')),
    path('api/emergency/', include('apps.emergency.urls')),
    path('api/vendor/', include('apps.vendor.urls')),
    path('api/ai/', include('apps.ai_engine.urls')),
    path('api/federated/', include('apps.federated.urls')),
    path('api/payment/', include('apps.payments.urls')),

    # FL maintenance status (lightweight poll for the doctor/patient AI UIs)
    path('api/fl/maintenance-status/', FLMaintenanceStatusView.as_view(), name='fl-maintenance-status'),

    # JWT token endpoints
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
