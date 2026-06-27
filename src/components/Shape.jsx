export default function Shape({ kind = "circle", size = 18, color }) {
  const style = color ? { color } : undefined;
  if (kind === "triangle") {
    return (
      <span
        className="shape shape--triangle"
        style={{
          ...style,
          borderLeftWidth: size * 0.55,
          borderRightWidth: size * 0.55,
          borderBottomWidth: size * 0.95,
        }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`shape shape--${kind}`}
      style={{ ...style, width: size, height: size }}
      aria-hidden
    />
  );
}
