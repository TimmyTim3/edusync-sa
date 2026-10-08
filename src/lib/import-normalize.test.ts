import {expect,test} from "vitest"; import {normStatus,normSeverity,toISODate} from "./import-normalize";
test("n",()=>{expect(normStatus("A")).toBe("absent");expect(normStatus("Half day")).toBe("half_day");expect(normSeverity("serious")).toBe("high");expect(normSeverity("Level 3")).toBe("medium");expect(toISODate("12/05/2026")).toBe("2026-05-12");});
