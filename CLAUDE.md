# spaceCraft — 인테리어 플래너 MVP

도면(벽·문·창)을 2D로 그리고 3D로 확인하며 가구를 배치하는 프론트 단독 웹앱. 저장은 IndexedDB.

## 명령
- pnpm 전역 설치가 안 되어 있으면 `corepack pnpm <cmd>`로 실행
- `pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm build`
- 단계 완료 조건: `pnpm typecheck && pnpm test` 통과

## 스택 (고정)
React 19 + Vite + TS strict, react-konva(2D), @react-three/fiber v9 + drei(3D), zustand + zundo, zod v4, idb-keyval, vitest.
버전 문제가 생기면 임의로 다운그레이드하지 말고 먼저 사용자에게 알린다.

## 설계 원칙 (반드시 지킬 것)
1. **진실원천 = 도면 문서 1개** (`src/store/docStore.ts`의 `doc`). 2D/3D는 문서를 그리는 뷰일 뿐. 3D에서 편집해도 문서를 고친 뒤 다시 그린다.
2. **스토어 분리**: 문서는 `docStore`(zundo로 undo/redo), 화면 상태(선택·모드·뷰포트·2D/3D·저장상태)는 `uiStore`(히스토리 없음).
3. **단위**: 길이는 정수 mm, 각도는 degree. 2D(mm, y-down) ↔ 3D(m, y-up) 변환은 `src/utils/coords.ts`에서만. 2D (x, y) → 3D (x/1000, h/1000, y/1000). 다른 곳에서 `/1000` 금지.
4. **벽은 corner 그래프**: wall.start/end는 cornerId. 꼭짓점을 공유하므로 꼭짓점 이동 시 연결된 벽이 함께 움직인다.
5. **불변 업데이트**: `updateFloor(f => newF)`. 변경이 없으면 같은 참조를 반환해 히스토리에 안 쌓이게 한다. 3D는 wall 객체 참조가 바뀐 벽만 재생성.
6. **기하 연산은 순수 함수**로 `src/geometry/`에 두고 `*.test.ts`로 테스트.
7. 드래그 하나 = 히스토리 1건 (zundo pause/resume).
8. 텍스트/숫자 입력은 Enter·blur 시에만 문서에 반영(글자마다 히스토리 금지).

## 문서 스키마 요약 (`src/model/schema.ts`가 원본)
- `schemaVersion`(현재 2), `unit: "mm"`, `floors[]`(MVP는 floors[0]만 UI 노출), `settings.gridSnap`
- `customCatalog[{id,category,name,width,depth,height}]`: 사용자가 가구 탭에서 추가한 가구 종류(id `f_…`). 문서에 들어 있어 JSON·undo와 함께 움직인다. 조회는 `catalogEntry(id, doc.customCatalog)`/`fullCatalog(custom)`, 추가·삭제는 `model/customCatalog.ts`(도면에 놓인 종류는 삭제 불가). 3D는 박스로 그린다(GLB 업로드 없음)
- floor: `height`, `corners[{id,x,y}]`, `walls[{id,start,end,thickness,height?,openings[]}]`, `rooms[]`, `items[]`
- opening: `offset` = 벽 start corner → 개구부 **중심** 거리(중심선 기준), `sill`(door는 0), door 전용 `hingeAtEnd?`·`swingReverse?`
  배치·이동은 `geometry/openings.ts`의 `placeOpening`(벽 끝 클램프 + 겹침 회피). 벽이 짧아지면 `updateFloor`가 `clampOpenings`로 되돌린다.
  개구부는 벽 분할로 소속 벽이 바뀔 수 있으니 `findOpening(floor, id)`로 찾는다.
- room: 닫힌 벽 루프에서 자동 생성(`geometry/rooms.ts`). `docStore.updateFloor`가 벽 구조(topologyKey)가 바뀔 때마다 `syncRooms`로 같은 set 안에서 재계산한다. rooms를 직접 추가/삭제하지 말 것.
  이름·색 유지 규칙: cornerIds 집합이 같으면 그대로, 아니면 공유 corner가 많고(3개 이상, 또는 2개+다각형 겹침) 면적이 큰 순으로 이어받음
- item: `x,y` = 바운딩박스 중심, `rotation`(deg), `width/depth/height?` = 카탈로그 치수 오버라이드
  편집은 `geometry/items.ts`(잠긴 가구는 이동·회전·치수 변경 불가, 잠금 해제·삭제는 가능). 2D 깊이(+y)가 가구 앞쪽, 3D에서는 +Z. GLB는 bbox를 W×D×H에 축별로 맞추고, 실패하면 박스로 대체(ErrorBoundary).
- 스키마 변경 시 `SCHEMA_VERSION` 올리고 `src/model/migrate.ts`의 `steps`에 변환 추가

## 폴더
- `src/model` 스키마·기본값·migrate·id / `src/store` docStore·uiStore·persistence
- `src/geometry` 순수 기하 함수 / `src/utils/coords.ts` 좌표 변환
- `src/editor2d` Konva 2D / `src/viewer3d` R3F 3D(첫 전환 시 lazy 로드) / `src/panels` UI 패널 / `src/hooks`
- 벽 접합부(마이터): `geometry/wallJoints.ts`의 `wallFootprints`가 corner마다 벽을 각도순 정렬해 이웃 벽 바깥선 교점으로 벽별 위에서 본 다각형을 만든다(corner 자신도 꼭짓점에 넣어 T자·십자 가운데를 빈틈없이 나눔). 바깥 끝이 두께/2×`MITER_LIMIT`(4)를 넘으면 bevel, 안쪽 교점이 벽 길이를 넘거나 180° 이어짐이면 직각으로 자른다. 2D `WallShapes`와 3D가 같은 다각형을 쓴다.
- 3D 벽: 개구부 없으면 footprint를 높이만큼 세운다. 개구부가 있으면 `splitFootprint`로 [접합부 조각 | 두께 일정한 가운데 | 접합부 조각]으로 나눠 가운데만 `viewer3d/wallOutline.ts` 측면 외곽(바닥·천장에 닿는 개구부는 notch, 떠 있는 창만 hole)을 두께만큼 밀고 합친다(CSG 없음). 그래서 접합부 조각에 걸친 개구부 부분(꺾인 모서리 안쪽 두께/2 이내)은 막힌다. `WallMesh`는 wall·corner 참조와 footprint 좌표가 바뀐 벽만 다시 만든다(이웃 벽이 움직이면 접합부가 바뀌므로).
- 테마: 브랜드 팔레트(#7B7CEB·#B8A8FF·#FFD1E6·#FFE38A·#CFE7FF)와 폰트(워드마크 Pixelify Sans, 본문 Nunito)는 `src/styles.css`의 `:root` 토큰. 캔버스 색은 `editor2d/WallShapes.tsx`의 `COLORS`, 3D는 `viewer3d`의 상수. 로고는 `public/logo.svg`(32×32 픽셀아트, 파비콘 겸용)
- `src/data/catalog.json` 가구 카탈로그, GLB는 `public/models/` (CC0만, 출처는 CREDITS.md)

## TODO
- 벽 접합부 마이터는 구현됨(위 참고). 남은 한계: 두께가 다른 벽의 180° 이어짐은 계단, 아주 짧은 벽(양 끝 접합부가 겹침)은 개구부를 무시하고 footprint만 세운다.
- 제외 범위: 백엔드/로그인, 마감재, 견적, 렌더샷, 다층 UI, 도면 이미지 업로드, AI
