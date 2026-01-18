import { useState } from 'react';

interface CopyButtonProps {
  getText: () => string;
  label?: string;
  className?: string;
}

export function CopyButton({
  getText,
  label = 'Copy',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = getText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 ${
        copied
          ? 'pixel-btn pixel-btn-success'
          : 'pixel-btn'
      } ${className}`}
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
