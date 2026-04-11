import uuid
import structlog
from flask import request, g

def RequestIdMiddleware(app):
    @app.before_request
    def before_request():
        # Get from headers if passed (e.g., from an upstream proxy), else generate
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        g.request_id = request_id
        
        # Bind to structlog context vars so every log in this request has it
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            ip_address=request.remote_addr,
            service="api_gateway"
        )
        
    @app.after_request
    def after_request(response):
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        return response
