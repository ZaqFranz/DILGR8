export function Spinner({ size = "md", onDark = false }: { size?: "sm" | "md"; onDark?: boolean }) {
  const classes = ["spinner", size === "sm" ? "spinner-sm" : "", onDark ? "spinner-on-dark" : ""]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} aria-hidden="true" />;
}
