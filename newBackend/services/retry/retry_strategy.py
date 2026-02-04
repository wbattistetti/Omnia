"""
Retry Strategy

Implements retry logic with exponential backoff for AI calls.
"""

from typing import Callable, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
    *args,
    **kwargs
) -> Tuple[Any, Optional[str]]:
    """
    Retry a function with exponential backoff (synchronous version).

    Args:
        func: Function to retry (synchronous)
        max_retries: Maximum number of retries
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        *args: Positional arguments for func
        **kwargs: Keyword arguments for func

    Returns:
        Tuple of (result, error_message)
    """
    import time
    last_error = None

    for attempt in range(max_retries):
        try:
            result = func(*args, **kwargs)
            return result, None
        except Exception as e:
            last_error = str(e)
            logger.warning(f"[retry] Attempt {attempt + 1}/{max_retries} failed: {last_error}")

            if attempt < max_retries - 1:
                # Calculate delay with exponential backoff
                delay = min(base_delay * (2 ** attempt), max_delay)
                logger.info(f"[retry] Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logger.error(f"[retry] All {max_retries} attempts failed")

    return None, last_error


def retry_sync_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
    *args,
    **kwargs
) -> Tuple[Any, Optional[str]]:
    """
    Retry a synchronous function with exponential backoff.

    Args:
        func: Synchronous function to retry
        max_retries: Maximum number of retries
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        *args: Positional arguments for func
        **kwargs: Keyword arguments for func

    Returns:
        Tuple of (result, error_message)
    """
    import time
    last_error = None

    for attempt in range(max_retries):
        try:
            result = func(*args, **kwargs)
            return result, None
        except Exception as e:
            last_error = str(e)
            logger.warning(f"[retry] Attempt {attempt + 1}/{max_retries} failed: {last_error}")

            if attempt < max_retries - 1:
                delay = min(base_delay * (2 ** attempt), max_delay)
                logger.info(f"[retry] Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logger.error(f"[retry] All {max_retries} attempts failed")

    return None, last_error
