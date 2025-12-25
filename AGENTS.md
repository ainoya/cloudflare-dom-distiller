## Project Context

This is an public repository.

## Language Guidelines

  * **Code & Documentation:** All code comments, documentation (README, JSDoc), variable names, and commit messages **must be written in English**, regardless of the language used in the conversation.
  * **Conversation:** When explaining concepts or replying to the user, **use the language the user is speaking** (e.g., if the user speaks Japanese, reply in Japanese).

## TypeScript Coding Standards

Adhere to a strict **Functional Programming** paradigm.

### 1\. Immutability & Safety

  * **No `let` or `var`:** Use `const` for all variable declarations.
  * **No `any`:** Strict type safety is required.
  * **No `null`:** Avoid using `null`. Use optional properties (`?`) or `undefined` instead.
  * **No Type Assertions:** Avoid using `as` to force types. Rely on type narrowing, type guards, and proper inference.

### 2\. Data Structures & Abstractions

  * **Use `type`:** Prefer `type` aliases over `interface` definitions.
  * **No Classes:** Do not use `class`. Use pure functions and data structures.
  * **Higher-Order Functions:** Utilize higher-order functions (map, filter, reduce, etc.) and composition instead of imperative loops or stateful logic.

### 3\. Example Style

```typescript
// BAD
interface User {
  name: string;
}
class UserManager {
  private users: User[] = [];
  addUser(user: any) {
    this.users.push(user as User);
  }
}

// GOOD
type User = {
  readonly name: string;
};

type UserState = {
  readonly users: ReadonlyArray<User>;
};

const addUser = (state: UserState, user: User): UserState => ({
  ...state,
  users: [...state.users, user],
});
```
