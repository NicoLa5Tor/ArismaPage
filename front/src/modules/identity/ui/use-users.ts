import type { UsersPort } from "../application/users-port"
import { usePort } from "../../shared/ui/admin-context"
export const useUsersPort = () => usePort<UsersPort>("users")
