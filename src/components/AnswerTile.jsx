import Shape from "./Shape";
import { shapeForIndex, readableText } from "@/lib/shapes";

export default function AnswerTile({
  answer,
  index,
  selected = false,
  dim = false,
  onClick,
  disabled = false,
}) {
  const text = readableText(answer.color);
  return (
    <button
      type="button"
      className={`answer-tile${selected ? " answer-tile--selected" : ""}${
        dim ? " answer-tile--dim" : ""
      }`}
      style={{ background: answer.color, color: text }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="answer-tile__glyph" style={{ color: text }}>
        <Shape kind={shapeForIndex(index)} size={18} />
      </span>
      <span>{answer.text}</span>
    </button>
  );
}
