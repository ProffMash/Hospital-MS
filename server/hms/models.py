from django.db import models, transaction
from django.db.models import F
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.forms import ValidationError
from rest_framework.response import Response


class CustomUserManager(BaseUserManager):
    def create_user(self, email, username, password=None, role='staff', **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not username:
            raise ValueError('Username is required')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, username, password, role='admin', **extra_fields)

class User(AbstractUser):
    email = models.EmailField(unique=True)
    # username = models.CharField(max_length=150, unique=True)
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('doctor', 'Doctor'),
        ('pharmacist', 'Pharmacist'),
        ('receptionist', 'Receptionist'),
    )
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default='admin')
    name = models.CharField(max_length=150)
    specialization = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='customuser_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='customuser_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    objects = CustomUserManager()

    @property
    def is_staff(self):
        return self.role in ['admin', 'doctor', 'pharmacist', 'receptionist'] or self.is_superuser

    def __str__(self):
        return self.email



class Patient(models.Model):
    # Allow male/female/other — keep choices explicit so serializer/model validation accepts values
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    # Provide a sensible default and explicit choices so API clients can send 'male'/'female'/'other'
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='other')
    address = models.TextField()
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_phone = models.CharField(max_length=20)
    emergency_contact_relationship = models.CharField(max_length=50)
    medical_history = models.TextField(blank=True, null=True)
    # Payment status for patient-level billing (e.g., upfront registration fees)
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('not_paid', 'Not Paid'),
    ]
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='not_paid')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Medicine(models.Model):
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    description = models.TextField()
    stock = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Diagnosis(models.Model):
    patient = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='diagnoses')
    doctor = models.ForeignKey('User', on_delete=models.CASCADE,null=True,blank=True, related_name='diagnoses')
    symptoms = models.TextField()
    treatment_plan = models.TextField()
    diagnosis = models.TextField()
    prescribed_medicines = models.JSONField(default=list)
    additional_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Diagnosis for {self.patient_name} by {self.doctor_name} on {self.date}"

##Added
class LabOders(models.Model):
    CHOICES = [
        ('sample_collected', 'Sample Collected'),
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    patient = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='laboratories')
    doctor = models.ForeignKey('User', on_delete=models.CASCADE, related_name='laboratories')
    tests = models.TextField()
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CHOICES, default='sample_collected')

class LabResults(models.Model):
    lab_order = models.ForeignKey('LabOders', on_delete=models.CASCADE, related_name='LabOrder')
    result = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Appointments(models.Model):
    patient = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey('User', on_delete=models.CASCADE, related_name='appointments')
    date = models.DateTimeField()
    time = models.TimeField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
    ], default='scheduled')
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('not_paid', 'Not Paid'),
    ]
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='not_paid')


class Sale(models.Model):
    medicine = models.ForeignKey('Medicine', on_delete=models.CASCADE, related_name='sales')
    quantity = models.PositiveIntegerField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()

    def clean(self):
        # Ensure quantity is positive (PositiveIntegerField already enforces >=0) and stock sufficiency
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than zero.'})

    def save(self, *args, **kwargs):
        # Adjust medicine stock atomically when creating or updating a Sale
        with transaction.atomic():
            # If updating an existing sale, compute differences
            if self.pk:
                old = Sale.objects.select_for_update().get(pk=self.pk)
                # If medicine changed, restore old medicine stock and deduct from new medicine
                if old.medicine_id != self.medicine_id:
                    # Restore stock to old medicine
                    old.medicine.refresh_from_db()
                    old.medicine.stock = F('stock') + old.quantity
                    old.medicine.save()

                    # Attempt to deduct from new medicine
                    updated = Medicine.objects.filter(pk=self.medicine_id, stock__gte=self.quantity).update(stock=F('stock') - self.quantity)
                    if not updated:
                        raise ValidationError({'medicine': 'Insufficient stock for the selected medicine.'})
                else:
                    # Same medicine: adjust by difference
                    diff = self.quantity - old.quantity
                    if diff > 0:
                        # need to reduce additional stock
                        updated = Medicine.objects.filter(pk=self.medicine_id, stock__gte=diff).update(stock=F('stock') - diff)
                        if not updated:
                            raise ValidationError({'quantity': 'Insufficient stock to increase sale quantity.'})
                    elif diff < 0:
                        # increase stock by -diff
                        Medicine.objects.filter(pk=self.medicine_id).update(stock=F('stock') + (-diff))
            else:
                # New sale: deduct stock if available
                updated = Medicine.objects.filter(pk=self.medicine_id, stock__gte=self.quantity).update(stock=F('stock') - self.quantity)
                if not updated:
                    raise ValidationError({'medicine': 'Insufficient stock for the selected medicine.'})

            # Call full_clean to ensure model validation (will raise ValidationError if invalid)
            self.full_clean()
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # When a sale is deleted, restore stock
        with transaction.atomic():
            # Restore stock for the associated medicine
            Medicine.objects.filter(pk=self.medicine_id).update(stock=F('stock') + self.quantity)
            return super().delete(*args, **kwargs)

    def __str__(self):
        return f"Sale for {self.medicine.name} on {self.date}"





def get_user_count():
    count = User.objects.count()
    return Response({"user_count": count})

def get_patient_count():
    count = Patient.objects.count()
    return Response({"patient_count": count})

def get_medicine_count():
    count = Medicine.objects.count()
    return Response({"medicine_count": count})

def get_diagnosis_count():
    count = Diagnosis.objects.count()
    return Response({"diagnosis_count": count})