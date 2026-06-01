from apps.auth_app.models import AuditLog, Notification


def log_audit(login_id, action, module='', entity_type='', entity_id=None,
              old_value=None, new_value=None, ip_address=None):
    AuditLog.objects.create(
        login_id=login_id,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
    )


def send_notification(login_id, title, message, notif_type='alert', related_id=None):
    """Persist a notification and (best-effort) push it via WebSocket.

    The WebSocket push is wrapped in try/except so a missing/down channel layer
    never prevents the DB record from being written.
    """
    notif = Notification.objects.create(
        login_id=login_id,
        title=title,
        message=message,
        notif_type=notif_type,
        related_id=related_id,
    )
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return notif
        async_to_sync(channel_layer.group_send)(
            f'notif_{login_id.login_id}',
            {
                'type': 'push_notification',
                'title': title,
                'message': message,
                'notif_type': notif_type,
                'related_id': str(related_id) if related_id else None,
            },
        )
    except Exception:
        pass
    return notif


def broadcast_new_doctor_to_patients(doctor_name='', hospital_name=''):
    """Tell every patient's notification socket that a new doctor is available
    so their 'Book a Doctor' list refreshes in real time.

    This is a lightweight UI-refresh hint (notif_type='doctor') sent directly
    to each patient's group — it is intentionally NOT persisted as a per-patient
    Notification row. Best-effort: silently no-ops if the channel layer is down.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from apps.auth_app.models import LoginCredentials

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False

        patient_ids = (
            LoginCredentials.objects
            .filter(role='patient', is_active=True)
            .values_list('login_id', flat=True)
        )
        message = (f'{doctor_name} is now available for consultation!'
                   if doctor_name else 'A new doctor is available!')
        for pid in patient_ids[:500]:
            try:
                async_to_sync(channel_layer.group_send)(
                    f'notif_{pid}',
                    {
                        'type': 'push_notification',
                        'title': 'New doctor available',
                        'message': message,
                        'notif_type': 'doctor',
                        'related_id': None,
                    },
                )
            except Exception:
                pass
        return True
    except Exception as e:
        print(f'[broadcast_new_doctor_to_patients] {e}')
        return False


def broadcast_order_status(order_id, status, message=''):
    """Push a status update to everyone subscribed to ws/orders/<order_id>/.

    Best-effort: silently no-ops if the channel layer is unavailable.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False
        async_to_sync(channel_layer.group_send)(
            f'order_{order_id}',
            {
                'type': 'order_status_update',
                'order_id': str(order_id),
                'status': status,
                'message': message,
            },
        )
        return True
    except Exception:
        return False


def broadcast_fl_update(fl_type, data):
    """Push an FL lifecycle event (round_started / weight_submitted /
    model_updated) to all subscribers of the 'fl_global' WebSocket group.

    Best-effort: never raises if the channel layer is unavailable.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False
        async_to_sync(channel_layer.group_send)(
            'fl_global',
            {
                'type': 'fl_update',
                'fl_type': fl_type,
                'data': data or {},
            },
        )
        return True
    except Exception as exc:
        print(f'FL broadcast error: {exc}')
        return False


def broadcast_medicine_update(user_id, update_type, data):
    """Push a medicine-order event to ws/medicine/<user_id>/ subscribers.

    Best-effort: never raises if the channel layer is unavailable.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False
        async_to_sync(channel_layer.group_send)(
            f'medicine_{user_id}',
            {
                'type': 'medicine_update',
                'update_type': update_type,
                'data': data or {},
            },
        )
        print(f'Medicine broadcast to {user_id}: {update_type}')
        return True
    except Exception as exc:
        print(f'Medicine broadcast error: {exc}')
        return False


def broadcast_gps(dispatch_id, lat, lng, eta_minutes=None):
    """Push a GPS update to ws/gps/<dispatch_id>/ subscribers."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False
        async_to_sync(channel_layer.group_send)(
            f'gps_{dispatch_id}',
            {
                'type': 'gps_update',
                'lat': lat,
                'lng': lng,
                'eta_minutes': eta_minutes,
                'dispatch_id': str(dispatch_id),
            },
        )
        return True
    except Exception:
        return False
