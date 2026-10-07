import type { ColumnDef } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/tables/DataTable";

interface RowData {
  name: string;
  value: number;
}

const columns: ColumnDef<RowData>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const data = Array.from({ length: 12 }, (_, index) => ({
  name: `Item ${String(index + 1).padStart(2, "0")}`,
  value: 12 - index,
}));

describe("DataTable", () => {
  it("filters, sorts, paginates, and handles row clicks", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        pageSize={5}
        onRowClick={onRowClick}
      />,
    );
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Filter table" }), {
      target: { value: "Item 12" },
    });
    expect(screen.getByText("Item 12")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Item 12"));
    expect(onRowClick).toHaveBeenCalledWith({ name: "Item 12", value: 1 });
    fireEvent.change(screen.getByRole("textbox", { name: "Filter table" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /value/i }));
    fireEvent.click(screen.getByRole("button", { name: /value/i }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Item 12");
  });

  it("shows its empty state", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });
});
