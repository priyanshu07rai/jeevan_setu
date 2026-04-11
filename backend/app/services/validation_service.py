from marshmallow import Schema, fields, validate, ValidationError
import re

phone_regex = re.compile(r"^\+?[1-9]\d{1,14}$") # E.164 format roughly

class AttachmentSchema(Schema):
    file_url = fields.URL(required=True)
    file_type = fields.String(validate=validate.OneOf(['image', 'video', 'audio', 'document']), required=True)

class ReportSchema(Schema):
    name = fields.String(allow_none=True)
    phone = fields.String(required=True) # Loosened for email/Unknown from frontend
    description = fields.String(required=True, validate=validate.Length(min=5, max=2000)) # Mapped from frontend
    message = fields.String(allow_none=True) # Optional for alternate clients
    lat = fields.Float(allow_none=True) # Mapped from frontend
    lon = fields.Float(allow_none=True) # Mapped from frontend
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    disaster_type = fields.String(allow_none=True)
    people_count = fields.Integer(allow_none=True)
    source = fields.String(load_default='web', validate=validate.OneOf(['sms', 'web', 'mobile', 'volunteer', 'api']))
    attachments = fields.List(fields.Nested(AttachmentSchema), allow_none=True)
    is_offline_submission = fields.Boolean(load_default=False)
    reported_at = fields.DateTime(allow_none=True)
    evidence = fields.String(allow_none=True) # Photo/Text from frontend

def validate_report_data(data):
    schema = ReportSchema()
    try:
        validated_data = schema.load(data)
        return validated_data, None
    except ValidationError as err:
        return None, err.messages
