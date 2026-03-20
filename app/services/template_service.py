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


def _safe_name(template_name: str) -> str:
    return "".join(c for c in template_name if c.isalnum() or c in "-_")


def list_templates(templates_path: str) -> list[dict]:
    path = Path(templates_path)
    if not path.exists():
        return []
    results = []
    for f in sorted(path.glob("*.xml")):
        stat = f.stat()
        results.append({
            "name": f.stem,
            "size_bytes": stat.st_size,
            "modified_at": stat.st_mtime,
        })
    return results


def read_template(templates_path: str, template_name: str) -> str | None:
    safe = _safe_name(template_name)
    if not safe:
        return None
    file_path = Path(templates_path) / f"{safe}.xml"
    if not file_path.exists():
        return None
    return file_path.read_text(encoding="utf-8")


def delete_template_file(templates_path: str, template_name: str) -> bool:
    safe = _safe_name(template_name)
    if not safe:
        return False
    file_path = Path(templates_path) / f"{safe}.xml"
    if not file_path.exists():
        return False
    file_path.unlink()
    return True


def write_template(templates_path: str, template_name: str, xml_content: str) -> dict:
    try:
        safe_name = _safe_name(template_name)
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
