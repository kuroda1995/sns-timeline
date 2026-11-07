// APIのレスポンスの型(JSDoc用)。エディタで補完・型の確認ができるように、各APIの関数の @returns で使う。
// schema.d.ts は docs/api/openapi.yaml から `npm run gen:api-types` で生成する(手で書き換えない、設計書 4-4)

/** @typedef {import('./schema').components['schemas']} Schemas */

/** @typedef {Schemas['UserResponse']} User ログイン中のユーザー情報 */
/** @typedef {Schemas['AuthResponse']} AuthResult 新規登録・ログインの結果 */
/** @typedef {Schemas['PostResponse']} Post */
/** @typedef {Schemas['PageResponsePostResponse']} PostPage */
/** @typedef {Schemas['NewPostsResponse']} NewPosts */
/** @typedef {Schemas['LikeResponse']} LikeResult */
/** @typedef {Schemas['CommentResponse']} Comment */
/** @typedef {Schemas['PageResponseCommentResponse']} CommentPage */
/** @typedef {Schemas['CreateCommentResponse']} CreateCommentResult */
/** @typedef {Schemas['CommentCountResponse']} CommentCount */
/** @typedef {Schemas['ProfileResponse']} Profile */
/** @typedef {Schemas['UserSummary']} UserSummary */
/** @typedef {Schemas['PageResponseUserSummary']} UserSummaryPage */
/** @typedef {Schemas['UserSearchResponse']} UserSearchResult */
/** @typedef {Schemas['UserListResponse']} UserList */
/** @typedef {Schemas['FollowResponse']} FollowResult */
/** @typedef {Schemas['AvatarResponse']} AvatarResult */

export {}
