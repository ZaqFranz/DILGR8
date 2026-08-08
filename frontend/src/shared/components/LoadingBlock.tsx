import { Spinner } from "./Spinner";

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
