import os
import base64
import re

# 所有需要打包的模块 js 文件路径
JS_MODULES = [
    'assets/js/three.module.js',
    'assets/js/OrbitControls.js',
    'assets/js/lines/LineSegmentsGeometry.js',
    'assets/js/lines/LineGeometry.js',
    'assets/js/lines/LineMaterial.js',
    'assets/js/lines/Line2.js',
    'assets/js/lines/LineSegments2.js',
    'assets/cities_data.js',
    'modules/scene.js',
    'modules/geography.js',
    'modules/features.js',
    'modules/data.js',
    'modules/hit-test.js',
    'modules/interaction.js',
    'modules/cities.js',
    'modules/labels.js'
]

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def file_to_data_url(filepath):
    with open(filepath, 'rb') as f:
        encoded_content = base64.b64encode(f.read()).decode('utf-8')
        return f"data:text/javascript;base64,{encoded_content}"

# 1. 构造 importmap
import_map = {"imports": {}}
for js_path in JS_MODULES:
    # 入口模块 three.module.js 用 "three" 这个 key，其他保持路径一致
    if js_path.endswith('three.module.js'):
        import_map['imports']['three'] = file_to_data_url(js_path)
    else:
        key = './' + js_path.replace('\\', '/')
        import_map['imports'][key] = file_to_data_url(js_path)

# 2. 读取 index.html、style.css、main.js
html_tpl = read_file('index.html')
css = read_file('style.css')
main_js = read_file('main.js')

# 3. 注入 CSS
html_tpl = re.sub(r'<link rel="stylesheet".*?>', f"<style>\n{css}\n</style>", html_tpl)

# 4. 注入 importmap
import_map_tag = f'<script type="importmap">\n{str(import_map).replace("'", "\"")}\n</script>'
html_tpl = re.sub(r'<script type="importmap">.*?</script>', import_map_tag, html_tpl, flags=re.DOTALL)

# 5. 注入 tz-lookup.js 内容
if os.path.exists('assets/js/tz-lookup.js'):
    tz_js = read_file('assets/js/tz-lookup.js')
    html_tpl = re.sub(r'<script src="./assets/js/tz-lookup.js"></script>', f'<script>\n{tz_js}\n</script>', html_tpl)

# 6. 主入口 main.js 直接写进 <script type="module"> ... </script>
html_tpl = re.sub(
    r'<script type="module" src="./main.js"></script>',
    f'<script type="module">\n{main_js}\n</script>',
    html_tpl
)

# 7. 输出
with open('globe_standalone.html', 'w', encoding='utf-8') as f:
    f.write(html_tpl)

print("打包成功：globe_standalone.html")
