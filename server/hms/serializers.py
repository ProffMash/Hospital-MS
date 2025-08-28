from rest_framework import serializers
import json
from .models import User, Patient, Medicine, Diagnosis, LabOders, LabResults, Appointments, Sale
from decimal import Decimal


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'email', 'role', 'name', 'specialization',
            'phone', 'address', 'is_staff', 'is_superuser', 'groups', 'user_permissions'
        ]


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'


class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = '__all__'


class DiagnosisSerializer(serializers.ModelSerializer):
    # expose FK ids for client matching plus readable name fields
    # allow clients to POST a patient id when creating a diagnosis
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    patient_name = serializers.SerializerMethodField(read_only=True)
    # allow optional doctor id on create/update
    doctor = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)
    doctor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Diagnosis
        fields = [
            'id',
            'patient',
            'patient_name',
            'doctor',
            'doctor_name',
            'symptoms',
            'treatment_plan',
            'diagnosis',
            'prescribed_medicines',
            'additional_notes',
            'created_at',
        ]

    def get_patient_name(self, obj):
        if getattr(obj, 'patient', None):
            first = getattr(obj.patient, 'first_name', '')
            last = getattr(obj.patient, 'last_name', '')
            name = f"{first} {last}".strip()
            return name or getattr(obj.patient, 'name', None)
        return None

    def get_doctor_name(self, obj):
        if getattr(obj, 'doctor', None):
            return getattr(obj.doctor, 'name', None) or getattr(obj.doctor, 'username', None)
        return None


class LabOrderSerializer(serializers.ModelSerializer):
    # provide both id and name fields for client convenience
    # accept PKs from clients when creating/updating
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    patient_name = serializers.SerializerMethodField(read_only=True)
    doctor = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)
    doctor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LabOders
        fields = [
            'id',
            'patient',
            'patient_name',
            'doctor',
            'doctor_name',
            'tests',
            'notes',
            'status',
        ]

    def get_patient_name(self, obj):
        if obj.patient:
            first = getattr(obj.patient, 'first_name', '')
            last = getattr(obj.patient, 'last_name', '')
            name = f"{first} {last}".strip()
            return name or getattr(obj.patient, 'name', None)
        return None

    def get_doctor_name(self, obj):
        if obj.doctor:
            return getattr(obj.doctor, 'name', None) or getattr(obj.doctor, 'username', None)
        return None

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        try:
            rep['tests'] = json.loads(instance.tests)
        except Exception:
            rep['tests'] = instance.tests
        return rep

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        tests = data.get('tests')
        if isinstance(tests, list):
            ret['tests'] = json.dumps(tests)
        return ret


class LabResultSerializer(serializers.ModelSerializer):
    """Return nested LabOrder data plus the result text.

    On write clients should provide the `lab_order` id and `result` text.
    On read `lab_order` is replaced with the nested `LabOrderSerializer` output.
    """

    lab_order = serializers.PrimaryKeyRelatedField(queryset=LabOders.objects.all(), write_only=True)
    lab_order_detail = LabOrderSerializer(source='lab_order', read_only=True)

    class Meta:
        model = LabResults
        fields = [
            'id',
            'lab_order',        # accepts PK on write
            'lab_order_detail', # nested representation on read
            'result',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def to_representation(self, instance):
        # Use default representation then replace the PK field with nested data for clarity.
        rep = super().to_representation(instance)
        # If nested data is available under lab_order_detail, expose it as `lab_order`
        if rep.get('lab_order_detail'):
            rep['lab_order'] = rep.pop('lab_order_detail')
        else:
            # fallback: try serializing manually
            try:
                rep['lab_order'] = LabOrderSerializer(instance.lab_order).data
            except Exception:
                rep['lab_order'] = rep.get('lab_order')
        return rep


class SaleSerializer(serializers.ModelSerializer):
    """Serializer for Sale. Validates quantity and stock, computes total_amount from medicine.price when not provided,
    and exposes nested medicine details on read.
    """
    medicine = serializers.PrimaryKeyRelatedField(queryset=Medicine.objects.all())
    medicine_detail = MedicineSerializer(source='medicine', read_only=True)

    class Meta:
        model = Sale
        # expose medicine_detail alongside raw fields for client convenience
        fields = ['id', 'medicine', 'medicine_detail', 'quantity', 'total_amount', 'date']

    def validate(self, attrs):
        qty = attrs.get('quantity')
        med = attrs.get('medicine')
        # ensure positive quantity
        if qty is None or qty <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be greater than zero.'})

        # When creating (no instance) or changing medicine/quantity, check stock availability now for better error messages.
        # If this is update, instance will be available on serializer and model-level logic will perform final checks.
        instance = getattr(self, 'instance', None)
        if instance is None:
            # new sale
            if med and not Medicine.objects.filter(pk=med.pk, stock__gte=qty).exists():
                raise serializers.ValidationError({'medicine': 'Insufficient stock for the selected medicine.'})
        else:
            # update: if medicine changed or qty increased, ensure stock suffices for the delta
            new_med = med or instance.medicine
            new_qty = qty
            if new_med.pk != instance.medicine_id:
                if not Medicine.objects.filter(pk=new_med.pk, stock__gte=new_qty).exists():
                    raise serializers.ValidationError({'medicine': 'Insufficient stock for the selected medicine.'})
            else:
                diff = new_qty - instance.quantity
                if diff > 0 and not Medicine.objects.filter(pk=new_med.pk, stock__gte=diff).exists():
                    raise serializers.ValidationError({'quantity': 'Insufficient stock to increase sale quantity.'})

        return attrs

    def _compute_total(self, medicine, quantity):
        try:
            price = getattr(medicine, 'price', Decimal('0'))
            return (Decimal(price) * Decimal(quantity)).quantize(Decimal('0.01'))
        except Exception:
            return Decimal('0.00')

    def create(self, validated_data):
        # compute total_amount if not provided
        if not validated_data.get('total_amount'):
            validated_data['total_amount'] = self._compute_total(validated_data['medicine'], validated_data['quantity'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # compute total_amount if not provided in update payload
        if 'total_amount' not in validated_data:
            med = validated_data.get('medicine', instance.medicine)
            qty = validated_data.get('quantity', instance.quantity)
            validated_data['total_amount'] = self._compute_total(med, qty)
        return super().update(instance, validated_data)


class AppointmentSerializer(serializers.ModelSerializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    patient_name = serializers.SerializerMethodField(read_only=True)
    doctor = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    doctor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Appointments
        fields = [
            'id',
            'patient',
            'patient_name',
            'doctor',
            'doctor_name',
            'date',
            'time',
            'reason',
            'status',
        ]

    def get_patient_name(self, obj):
        if getattr(obj, 'patient', None):
            first = getattr(obj.patient, 'first_name', '')
            last = getattr(obj.patient, 'last_name', '')
            name = f"{first} {last}".strip()
            return name or getattr(obj.patient, 'email', None)
        return None

    def get_doctor_name(self, obj):
        if getattr(obj, 'doctor', None):
            return getattr(obj.doctor, 'name', None) or getattr(obj.doctor, 'email', None)
        return None

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        return rep



class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['email', 'name', 'password', 'role', 'specialization', 'phone', 'address']

    def create(self, validated_data):
        # Ensure a username is provided to the user manager; derive from email if absent
        raw_email = validated_data['email']
        base_username = validated_data.get('username') or raw_email.split('@')[0]
        username = base_username
        # Ensure uniqueness by appending a numeric suffix if needed
        counter = 0
        while User.objects.filter(username=username).exists():
            counter += 1
            username = f"{base_username}{counter}"

        user = User.objects.create_user(
            email=raw_email,
            username=username,
            password=validated_data['password'],
            name=validated_data.get('name', ''),
            role=validated_data.get('role', 'staff'),
            specialization=validated_data.get('specialization', ''),
            phone=validated_data.get('phone', ''),
            address=validated_data.get('address', ''),
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
