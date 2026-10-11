/**
 * A slot keeps its last state across soft navigations that it doesn't match,
 * so every other route renders nothing here, closing any open modal.
 */
export default function CatchAll(): null {
  return null;
}
