// The controlled form from docs/recipes/forms.md.
import { useActionState, useEffect, useRef, useState } from "react";

/** A controlled field with a live count, greeted without leaving the page. */
export function GreetingForm() {
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  // Text typed before hydration is in the field, not in state: adopt it.
  useEffect(() => {
    setName(field.current?.value ?? "");
  }, []);
  // Read the submitted data, not state: a submit made before hydration
  // replays with the data the form held then.
  const [greeting, greet] = useActionState((_: string, data: FormData) => {
    const submitted = data.get("name");
    const text = submitted instanceof File ? "" : (submitted ?? "").trim();
    return text === "" ? "Enter a name." : `Hello, ${text}.`;
  }, "");
  return (
    <form action={greet}>
      <label>
        Name
        <input
          name="name"
          onChange={(event) => {
            setName(event.target.value);
          }}
          ref={field}
          value={name}
        />
      </label>
      <p>{name.length} characters</p>
      <button type="submit">Greet</button>
      <output>{greeting}</output>
    </form>
  );
}
