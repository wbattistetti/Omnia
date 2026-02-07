export type FakeDataNode = {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "object";
  children?: FakeDataNode[];
};
