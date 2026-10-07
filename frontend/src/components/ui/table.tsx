import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b", className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-muted/50", className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-3 align-middle", className)} {...props} />;
}
