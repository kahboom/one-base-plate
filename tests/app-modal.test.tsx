import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import AppModal from "../src/components/AppModal";

function ControlledModal() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="open-btn">
        Open
      </button>
      <AppModal open={open} onClose={() => setOpen(false)} ariaLabel="Test dialog">
        <p data-testid="inner-content">Hello</p>
      </AppModal>
    </>
  );
}

describe("AppModal", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("locks body scroll while open and restores on close", () => {
    const { unmount } = render(<ControlledModal />);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("dialog", { name: "Test dialog" }));
    expect(document.body.style.overflow).toBe("");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<ControlledModal />);
    fireEvent.click(screen.getByRole("dialog", { name: "Test dialog" }));
    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();
  });

  it("does not close when clicking inner content", async () => {
    const user = userEvent.setup();
    render(<ControlledModal />);
    await user.click(screen.getByTestId("inner-content"));
    expect(screen.getByTestId("inner-content")).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    render(<ControlledModal />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("inner-content")).not.toBeInTheDocument();
  });

  it("does not close on backdrop when closeOnBackdropClick is false", () => {
    render(
      <AppModal open onClose={() => {}} ariaLabel="No backdrop close" closeOnBackdropClick={false}>
        <span data-testid="stay">x</span>
      </AppModal>,
    );
    fireEvent.click(screen.getByRole("dialog", { name: "No backdrop close" }));
    expect(screen.getByTestId("stay")).toBeInTheDocument();
  });
});
