from django.shortcuts import render
from rest_framework import viewsets
from .models import User, Patient, Medicine, Diagnosis,  LabOders, LabResults, Appointments, Sale
from .serializers import UserSerializer, PatientSerializer, MedicineSerializer, DiagnosisSerializer,  LabOrderSerializer, LabResultSerializer, AppointmentSerializer, SaleSerializer
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, LoginSerializer
from rest_framework.decorators import api_view, action
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

# Create your views here.
User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        count=Patient.objects.count()
        return Response({"patient_count": count})

class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        low_stock_medicines = Medicine.objects.filter(stock__lt=10)
        serializer = self.get_serializer(low_stock_medicines, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        count = Medicine.objects.count()
        return Response({"medicine_count": count})

class DiagnosisViewSet(viewsets.ModelViewSet):
    queryset = Diagnosis.objects.all().select_related('patient', 'doctor')
    serializer_class = DiagnosisSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        count = Diagnosis.objects.count()
        return Response({"diagnosis_count": count})

class LabOrderViewSet(viewsets.ModelViewSet):
    queryset = LabOders.objects.all().select_related('patient', 'doctor')
    serializer_class = LabOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

class LabResultViewSet(viewsets.ModelViewSet):
    """ViewSet for lab results. Returns nested lab_order data (including its patient/doctor) to reduce queries."""
    queryset = LabResults.objects.all().select_related(
        'lab_order',
        'lab_order__patient',
        'lab_order__doctor',
    )
    serializer_class = LabResultSerializer
    permission_classes = [permissions.IsAuthenticated]

from django.core.exceptions import ValidationError as DjangoValidationError


class SaleViewSet(viewsets.ModelViewSet):
    # optimize queries by selecting related medicine
    queryset = Sale.objects.all().select_related('medicine')
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
        except DjangoValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_update(serializer)
        except DjangoValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except DjangoValidationError as e:
            return Response(e.message_dict if hasattr(e, 'message_dict') else {'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AppointmentViewSet(viewsets.ModelViewSet):
    """Basic Appointment viewset to manage appointments.

    Keeps behavior minimal and consistent with other viewsets.
    """
    queryset = Appointments.objects.all().select_related('patient', 'doctor')
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # create token for the new user
            token, _ = Token.objects.get_or_create(user=user)
            return Response({'message': 'User registered successfully', 'token': token.key}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            user = authenticate(request, username=email, password=password)  # Use username=email
            if user is not None:
                # ensure user has a token and return it
                token, _ = Token.objects.get_or_create(user=user)
                return Response({
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'name': user.name,
                    'specialization': user.specialization,
                    'phone': user.phone,
                    'address': user.address,
                    'message': 'Login successful',
                    'token': token.key,
                }, status=status.HTTP_200_OK)
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




@api_view(['GET'])
def get_user_count(request):
    count = User.objects.count()
    return Response({"user_count": count})