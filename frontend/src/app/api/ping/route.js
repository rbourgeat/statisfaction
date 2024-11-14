import ping from "ping";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  try {
    const result = await ping.promise.probe(address, {
      timeout: 2,
    });
    return new Response(JSON.stringify({ alive: result.alive }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Ping failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}