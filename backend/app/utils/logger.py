import structlog
import logging
import os
import sys

def setup_logger(app=None, service_name="api_gateway"):
    if not os.path.exists('logs'):
        os.mkdir('logs')

    # Basic configuration for standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # Add shared processors for structlog
    shared_processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.contextvars.merge_contextvars, # To include request context
        structlog.processors.CallsiteParameterAdder(
            {
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.FUNC_NAME,
                structlog.processors.CallsiteParameter.LINENO,
            }
        ),
        structlog.processors.dict_tracebacks,
    ]

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    # Determine log file based on service
    log_file = "logs/api.log" if service_name == "api_gateway" else "logs/worker.log"
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(formatter)
    
    error_handler = logging.FileHandler("logs/error.log")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear() # clear default handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)
    
    # Also log to console during development (JSON formatted)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    # Bind default service name
    structlog.contextvars.bind_contextvars(service=service_name)
    
    if app:
        app.logger.handlers.clear()

def get_logger(name=__name__):
    return structlog.get_logger(name)
