import { parse } from "yaml";
const source = await Bun.file("docs/siape-openapi.yml").text();
await Bun.write(
  "docs/siape-openapi.json",
  JSON.stringify(parse(source), null, 2),
);
