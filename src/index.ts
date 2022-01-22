import fetch from "node-fetch";

export { fetch };

export class HerokuAccount {}

async function test() {
  const resp = await fetch("https://lichess.org");
  const text = await resp.text();
  console.log(text);
}

test();
