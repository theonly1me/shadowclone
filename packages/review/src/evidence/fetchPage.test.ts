import { expect, spyOn, test } from "bun:test";
import { fetchPageText } from "./fetchPage";

test.each([
  "http://[::ffff:127.0.0.1]/",
  "http://[::ffff:169.254.169.254]/",
  "http://[0:0:0:0:0:ffff:7f00:1]/",
])("private documentation URL %s never reaches fetch", async (address) => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("synthetic documentation"),
  );

  try {
    expect(await fetchPageText(address)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  } finally {
    request.mockRestore();
  }
});

test("a redirect to mapped metadata stops before fetching the destination", async () => {
  const request = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://[::ffff:169.254.169.254]/" },
      }),
    )
    .mockResolvedValue(new Response("synthetic metadata"));

  try {
    expect(await fetchPageText("https://93.184.216.34/docs")).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    request.mockRestore();
  }
});

test("a public mapped documentation address still returns its text", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("synthetic documentation"),
  );

  try {
    expect(await fetchPageText("https://[::ffff:8.8.8.8]/docs")).toBe("synthetic documentation");
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    request.mockRestore();
  }
});
