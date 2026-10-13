import { APP_ICON_SIZES } from "@/lib/appIcon";
import { monogramImage } from "@/lib/monogramImage";

export function generateStaticParams(): { size: string }[] {
  return APP_ICON_SIZES.map((size) => ({ size: String(size) }));
}

/** The Z narrow enough to stay inside a maskable icon's safe circle, so one image serves both purposes. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }): Promise<Response> {
  const size = Number((await params).size);
  if (!APP_ICON_SIZES.some((allowed) => allowed === size)) return new Response(null, { status: 404 });
  return monogramImage({ width: size, height: size }, 0.5);
}
