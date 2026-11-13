import { z } from "zod";

export const regraSenha = z
  .string()
  .min(10, "A senha precisa de pelo menos 10 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres");
