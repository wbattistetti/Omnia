from pathlib import Path
from jinja2 import Environment, FileSystemLoader, StrictUndefined

# Base directory for prompts
BASE = Path(__file__).parent

# Create Jinja2 environment with strict undefined variables
_env = Environment(
    loader=FileSystemLoader(str(BASE)),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True
)

def render(name: str, **ctx) -> str:
    """
    Render a prompt template by name with the given context.
    
    Args:
        name: Template name without extension
        **ctx: Context variables for the template
        
    Returns:
        Rendered prompt string
        
    Raises:
        FileNotFoundError: If no matching template found
    """
    # Try different file extensions
    for candidate in (f"{name}.jinja.md", f"{name}.md"):
        template_path = BASE / candidate
        if template_path.exists():
            return _env.get_template(candidate).render(**ctx)
    
    raise FileNotFoundError(f"Prompt template '{name}' not found in {BASE}")
