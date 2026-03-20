import xml.etree.ElementTree as ET
from pathlib import Path


def validate_xml(xml_content: str) -> None:
    """Raise ValueError if xml_content is not a well-formed Unraid Container template."""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise ValueError(f"Malformed XML: {exc}") from exc

    if root.tag != "Container":
        raise ValueError(
            f"Invalid template: root element must be <Container>, got <{root.tag}>"
        )


def write_template(templates_path: str, template_name: str, xml_content: str) -> dict:
    try:
        # Sanitize: only alphanumeric, dash, underscore
        safe_name = "".join(c for c in template_name if c.isalnum() or c in "-_")
        if not safe_name:
            return {
                "action": "error",
                "outcome": "error",
                "error_message": "Invalid template name — use alphanumeric characters, dashes, or underscores.",
            }

        path = Path(templates_path)
        path.mkdir(parents=True, exist_ok=True)

        file_path = path / f"{safe_name}.xml"
        action = "updated" if file_path.exists() else "created"
        file_path.write_text(xml_content, encoding="utf-8")

        return {"action": action, "outcome": "success"}
    except Exception as exc:
        return {"action": "error", "outcome": "error", "error_message": str(exc)}
