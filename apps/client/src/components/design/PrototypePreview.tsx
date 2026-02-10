interface PrototypePreviewProps {
  code: string;
  designCSS?: string;
}

export function PrototypePreview({ code, designCSS }: PrototypePreviewProps) {
  // Strip export default and capture the component for rendering
  const processedCode = code
    .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+default\s+(\w+)\s*;?\s*$/gm, '')
    .replace(/export\s+default\s+/g, 'const __DefaultExport__ = ');

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"><\/script>
  ${designCSS ? `<style>\n:root {\n${designCSS}\n}\n<\/style>` : ''}
  <style>body { margin: 0; font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${processedCode}
    const Component = typeof __DefaultExport__ !== 'undefined' ? __DefaultExport__ : (typeof App !== 'undefined' ? App : null);
    if (Component) {
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
    }
  <\/script>
</body>
</html>`;

  return (
    <iframe
      srcDoc={srcdoc}
      className="w-full h-full border-0"
      sandbox="allow-scripts"
      title="Design Preview"
    />
  );
}
