from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, RegisterView, LoginView, UserViewSet, PatientViewSet, DiagnosisViewSet, AppointmentViewSet, SaleViewSet, LabOrderViewSet, LabResultViewSet

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'users', UserViewSet, basename='user')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'diagnoses', DiagnosisViewSet, basename='diagnosis')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'lab-orders', LabOrderViewSet, basename='lab-order')
router.register(r'lab-results', LabResultViewSet, basename='lab-result')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('patients/count/', PatientViewSet.as_view({'get': 'count'}), name='patient-count'),
    path('medicines/count/', MedicineViewSet.as_view({'get': 'count'}), name='medicine-count'),
    path('medicines/low_stock/', MedicineViewSet.as_view({'get': 'low_stock'}), name='low-stock-medicines'),
    path('diagnoses/count/', DiagnosisViewSet.as_view({'get': 'count'}), name='diagnosis-count'),
    path('total_revenue/', SaleViewSet.as_view({'get': 'total_revenue'}), name='total-revenue'),
    path('today_sales/', SaleViewSet.as_view({'get': 'today_sales'}), name='today-sales'),
]
