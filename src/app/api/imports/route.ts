export const runtime = "nodejs";
export function POST() {
  return Response.json(
    {
      error:
        "A importação CSV foi descontinuada. Utilize um arquivo XLSX na importação por instrumento.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
