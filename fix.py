import re

with open('frontend_web/src/services/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r"if \(\!response\.ok\) throw new Error\('.*?'\);")

replacement = """if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }"""

new_content = pattern.sub(replacement, content)

# There are a few `if (!res.ok) throw new Error('...');` at the bottom
pattern2 = re.compile(r"if \(\!res\.ok\) throw new Error\('.*?'\);")
replacement2 = """if (!res.ok) {
        const text = await res.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }"""
new_content = pattern2.sub(replacement2, new_content)

with open('frontend_web/src/services/api.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Modified api.js')

with open('backend/api/disasters.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'logger = logging.getLogger(__name__)' not in content:
    content = content.replace('from flask_cors import CORS, cross_origin', 'from flask_cors import CORS, cross_origin\nimport logging\nlogger = logging.getLogger(__name__)')

pattern = re.compile(r'except Exception as e:\n\s+return jsonify\(\{"error": str\(e\)\}\), 500')
replacement = """except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500"""

new_content = pattern.sub(replacement, content)

with open('backend/api/disasters.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Modified disasters.py')
