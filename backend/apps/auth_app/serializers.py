from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from django.contrib.auth.hashers import check_password
from .models import LoginCredentials


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            user = LoginCredentials.objects.get(email=data['email'].lower())
        except LoginCredentials.DoesNotExist:
            raise AuthenticationFailed('Invalid credentials')

        if not check_password(data['password'], user.password_hash):
            raise AuthenticationFailed('Invalid credentials')

        if not user.is_approved:
            raise PermissionDenied('Account pending approval')

        if not user.is_active:
            raise PermissionDenied('Account is deactivated')

        data['user'] = user
        return data


class PatientRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField(max_length=120)
    dob = serializers.DateField()
    gender = serializers.ChoiceField(
        choices=['male', 'female', 'other'], required=False, default=''
    )
    blood_group = serializers.CharField(max_length=5, required=False, default='')
    height_cm = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True, default=None
    )
    weight_kg = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True, default=None
    )
    address = serializers.CharField(required=False, default='')
    emergency_contact = serializers.CharField(max_length=15, required=False, default='')
    phone = serializers.CharField(max_length=15, required=False, default='')

    def validate_email(self, value):
        if LoginCredentials.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists')
        return value.lower()

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError('Password must be at least 6 characters')
        return value


class HospitalRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    hospital_name = serializers.CharField(max_length=200)
    registration_no = serializers.CharField(max_length=100)
    address = serializers.CharField()
    city = serializers.CharField(max_length=100)
    state = serializers.CharField(max_length=100, required=False, default='Kerala')
    contact_phone = serializers.CharField(max_length=15, required=False, default='')
    contact_email = serializers.EmailField(required=False, default='')
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True, default=None
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True, default=None
    )

    def validate_email(self, value):
        if LoginCredentials.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists')
        return value.lower()

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError('Password must be at least 6 characters')
        return value

    def validate_registration_no(self, value):
        from apps.hospital.models import HospitalRegistration
        if HospitalRegistration.objects.filter(registration_no=value).exists():
            raise serializers.ValidationError(
                'A hospital with this registration number already exists'
            )
        return value


class PharmacistRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    pharmacy_name = serializers.CharField(max_length=200)
    license_no = serializers.CharField(max_length=100)
    full_name = serializers.CharField(max_length=120)
    address = serializers.CharField(required=False, default='')

    def validate_email(self, value):
        if LoginCredentials.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists')
        return value.lower()

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError('Password must be at least 6 characters')
        return value

    def validate_license_no(self, value):
        from apps.pharmacy.models import PharmacistRegistration
        if PharmacistRegistration.objects.filter(license_no=value).exists():
            raise serializers.ValidationError(
                'A pharmacist with this license number already exists'
            )
        return value


class VendorRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    company_name = serializers.CharField(max_length=200)
    tax_id = serializers.CharField(max_length=50)
    contact_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=15, required=False, default='')

    def validate_email(self, value):
        if LoginCredentials.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists')
        return value.lower()

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError('Password must be at least 6 characters')
        return value

    def validate_tax_id(self, value):
        from apps.vendor.models import VendorRegistration
        if VendorRegistration.objects.filter(tax_id=value).exists():
            raise serializers.ValidationError('A vendor with this tax ID already exists')
        return value
