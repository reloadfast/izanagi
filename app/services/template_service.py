from pathlib import Path


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
