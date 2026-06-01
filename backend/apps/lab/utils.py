"""Lab slot helpers — auto-generation and 12-hour time formatting."""
from datetime import date, timedelta, datetime, time


def fmt_12hr(t):
    """Format a datetime.time as Indian 12-hour text, e.g. '8:30 AM'.

    Implemented manually because the `%-I` strftime directive is not portable
    (it fails on Windows).
    """
    if t is None:
        return ''
    hour = t.hour % 12 or 12
    period = 'AM' if t.hour < 12 else 'PM'
    return f"{hour}:{t.minute:02d} {period}"


def generate_lab_slots(hospital, days_ahead=30):
    """Create LabSlot rows for the hospital's working days within `days_ahead`.

    Idempotent — uses get_or_create so re-running only fills gaps. Creates a
    sensible default HospitalLabConfig the first time if none exists.
    """
    from apps.lab.models import HospitalLabConfig, LabSlot

    try:
        config = HospitalLabConfig.objects.get(hospital_id=hospital, is_active=True)
    except HospitalLabConfig.DoesNotExist:
        config = HospitalLabConfig.objects.create(
            hospital_id=hospital,
            working_days=[0, 1, 2, 3, 4, 5],
            start_time=time(8, 0),
            end_time=time(18, 0),
            slot_duration_minutes=30,
            max_patients_per_slot=5,
            lunch_break_start=time(13, 0),
            lunch_break_end=time(14, 0),
        )

    today = date.today()
    slots_created = 0
    slot_duration = timedelta(minutes=config.slot_duration_minutes or 30)

    for day_offset in range(1, (days_ahead or config.advance_booking_days) + 1):
        slot_date = today + timedelta(days=day_offset)
        if slot_date.weekday() not in (config.working_days or []):
            continue

        current_time = datetime.combine(slot_date, config.start_time)
        end_datetime = datetime.combine(slot_date, config.end_time)

        while current_time < end_datetime:
            slot_start = current_time.time()
            slot_end = (current_time + slot_duration).time()

            # Skip slots that start during the lunch break.
            if config.lunch_break_start and config.lunch_break_end:
                if config.lunch_break_start <= slot_start < config.lunch_break_end:
                    current_time += slot_duration
                    continue

            _, created = LabSlot.objects.get_or_create(
                hospital_id=hospital,
                slot_date=slot_date,
                start_time=slot_start,
                defaults={
                    'end_time': slot_end,
                    'max_patients': config.max_patients_per_slot,
                    'is_blocked': False,
                },
            )
            if created:
                slots_created += 1

            current_time += slot_duration

    print(f"[SLOTS] Generated {slots_created} new slots for {hospital.hospital_name}")
    return slots_created
