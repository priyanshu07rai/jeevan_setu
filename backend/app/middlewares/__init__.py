def init_middlewares(app):
    from app.middlewares.request_id import RequestIdMiddleware
    RequestIdMiddleware(app)
    
    # Can expand this to add more cross-cutting concerns natively
    return app
