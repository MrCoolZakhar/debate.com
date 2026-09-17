# GAVELLING — TRANSLATIONS AGENT BRIEFING
## Up-to-date guide for adding a new language to Gavelling

**17 Sep 2026, device voting:** ADDED 38 keys in all four locales, placed after `voting_rc_start`: `voting_method_label`, `voting_method_title`, `voting_method_hint`, `voting_method_rollcall`, `voting_method_device` (Settings → Voting and the roll call switch); `device_join_checking|all|missing|idle|error|retry` and `device_vote_count|waiting|voted|not_voted|not_joined|reveal|reveal_title|reveal_body|reveal_cancel|revealing|reveal_failed|status_failed|follower` (`src/components/voting/DeviceVotingPanel.tsx`); `dvote_eyebrow|choose|confirm_title|confirm_btn|back|saving|cast|can_change|change|revealed|not_holder|failed|closed|pv_no_abstain` (`src/components/delegate/DeviceBallotScreen.tsx`). Placeholders: `{n}`, `{names}`, `{cast}`, `{total}`, `{name}`, `{choice}`. The delegate ballot reuses `voting_in_favour`, `voting_against`, `voting_abstain`, `voting_with_rights_label` and `voting_choice_*`.

**17 Sep 2026, create page on one screen (not recounted: other sessions were adding keys too):** in all four locales, placed after `create_cta_needs`, ADDED 9 keys: `create_chairs` (the chairs field label), `create_chair_add`, `create_chair_more` (placeholder once one chair is a chip), `create_chair_remove` (`{name}`), `create_preview_chairs` (`{names}`, the live preview line), `create_preview_topic_empty`, `create_conference_prompt`, `create_conference_login`, `create_conference_open` (shown instead of Log in when already signed in). The live preview reuses `rollcall_topic` and `create_untitled`. No longer read by `src/app/create/page.tsx` (left in place): `create_title` is now a screen-reader heading only, `create_chair_name`, `create_step_committee_hint`, `create_step_delegations_hint`. `create_quick_bundles` is now a visually hidden group label and the bundle tooltip; `create_paste_hint` sits beside the Auto-match button. Net +9 per locale.

**17 Sep 2026, voting page top bar, rights queue:** ADDED in all four locales `voting_rights_move` (`{name}`, the grip's accessible name) and `voting_rights_move_hint` (its tooltip), read by `src/components/voting/RightsQueue.tsx`. The voting header now reuses `chair_hdr_show_code`, `chair_hdr_chat_unread`, `chair_hdr_scoreboard`, `chair_hdr_settings`, `tab_chat`. `voting_pick_status_ready` is no longer read (the Ready pill and count were removed); `voting_tally_hidden` is still read on the all-voted screen. Net +2 per locale.

**17 Sep 2026, voting roll call replaces the pre-vote screen:** `PreVoteScreen.tsx` deleted, `src/components/voting/VotingRollCall.tsx` added. In all four locales: REMOVED `voting_prevote_title`, `voting_prevote_roll_call_hint`, `voting_prevote_seg_pv` (-3 per locale). RENAMED the other 29 `voting_prevote_*` keys to `voting_rc_*`, text unchanged: `close` → `voting_rc_back`, `seg_absent` → `voting_rc_status_absent`, `seg_present` → `voting_rc_status_present`, `present_voting` → `voting_rc_status_pv`, every other suffix kept (`for_doc`, `done`, `start`, `start_sub`, `present`, `to_pass`, `of_total`, `tab_abst_off|counted|excluded`, `needed_line`, `needed_consensus`, `abstain_off|counted|excluded`, `veto_off_line`, `veto_unanimous_line`, `veto_line`, `veto_unanimous`, `quorum_none|met|not_met`, `threshold_simple_sub|two_thirds_sub|consensus_sub`). Placeholders unchanged. Reuses `rollcall_clear_all`, `rollcall_all_present`, `rollcall_all_pv`, `rollcall_observer*`, `rollcall_list_label`, `rollcall_add_delegate`, `voting_roll_call_heading`. Every `voting_rc_*` key is read and none is missing (grep-checked). Net -3 per locale.

**Last counted 16 Sep 2026, after the session UI round review (voting empty state, create page add bar):** **1556 keys per locale**, identical key sets in all four (0 missing, 0 extra, 0 duplicates). The round itself landed at 1557; this review removed one more key. Changes recorded here because the round's own entries did not name them:
- **Voting picker (`src/components/voting/ResolutionPicker.tsx`):** REMOVED `voting_pick_eyebrow`. Added 8 keys × 4 locales for the empty state (no draft resolution introduced yet): `voting_pick_empty_title` (`{doc}`), `voting_pick_empty_body` (`{doc}`, Moderator), `voting_pick_empty_body_follow` (`{doc}`, a Commenter following the Moderator), `voting_pick_empty_steps_label`, `voting_pick_empty_step_1`, `voting_pick_empty_step_2` (`{doc}`), `voting_pick_empty_step_3`, `voting_pick_empty_cta`. `{doc}` is the committee's own singular draft resolution name (`docName`), lower-cased by the picker.
- **Pre-vote screen:** REMOVED `voting_prevote_eyebrow` × 4 (16 Sep review: `PreVoteScreen.tsx` no longer renders the eyebrow, nothing read it).
- **Create page (`src/app/create/page.tsx`):** REMOVED `create_search_add`, `create_search_placeholder` (the search field became one add bar) and `create_unsc_warning` (it promised veto power that nothing set). Added 3 keys × 4 locales in their place: `create_add_country` (section label), `create_add_country_placeholder`, `create_add_btn` (the + Add button; an empty field adds nothing).
- **Sidebar "Ready to speak":** no new key. The chair sidebar row at #1 and the collapsed rail's accessible name reuse `gsl_on_deck` when nobody is seated on the GSL.

**17 Sep 2026, document introduction round (not recounted: other sessions were adding keys at the same time):** in all four locales, directly after `documents_timer_reset_title`. Added 13 keys × 4 locales: `documents_timer_start`, `documents_timer_resume`, `documents_timer_pause`, `documents_timer_continue` (sentence-case labels for the timer's primary key, so nothing strips "▶ " / " →" any more), `documents_timer_sponsors` (`{label}`, `{names}`: the sponsor flags' accessible name), `documents_switch_label`, `documents_switch_reading`, `documents_switch_presentation`, `documents_switch_qa`, `documents_switch_done`, `documents_switch_go` (`{stage}`), `documents_switch_timings`, `documents_switch_timings_title` (the stage switcher). `documents_stage_reading_short`, `documents_start_btn`, `documents_resume_btn` and `documents_continue_btn` are no longer read anywhere in `src/` (grep, 17 Sep 2026); kept for now, safe to remove from all four locales together.

**17 Sep 2026, Settings round (What delegates can do, knock chooser, Motions / Points columns, lean People; counted 1578 per locale right after, identical key sets; other sessions were adding keys too):** ADDED 17 keys × 4 locales where the Floor rules block was (after `stg_chair_state_offline`): `stg_delegates_can`, `stg_delegates_can_hint`, `stg_can_chat`, `stg_can_chat_note`, `stg_can_rollcall`, `stg_can_rollcall_note`, `stg_can_join`, `stg_can_join_note`, `stg_can_on`, `stg_can_off` (Access → What delegates can do), `stg_knock_less` / `stg_knock_more` (`{n}`, the gavel knock -/+ steps), `stg_other_motions` (Motions right column), `stg_currently_moderating`, `stg_currently_commenting`, `stg_currently_offline` (People dais row; the parentheses are inside the strings), `stg_joined_count` (`{n}`, `{total}`). The replicas reuse `tab_chat`, `delegate_roll_call_label`, `delegate_present_btn`, `delegate_pv_btn`. REWORDED `stg_access_desc` × 4. REMOVED, no reader left, × 4: `stg_access_floor`, `stg_access_floor_hint`, `stg_lock_rollcall_label`, `stg_lock_rollcall_note`, `stg_disable_chat_label`, `stg_disable_chat_note`, `stg_labels`, `settings_chair_approval_label`, `settings_chair_approval_note`, `settings_gsl_require_next_label`, `settings_gsl_require_next_note` (the setting has no Settings row), and the People keys `stg_bar_aria`, `stg_chair_devices`, `stg_chair_devices_hint`, `stg_chair_remove_aria`, `stg_chair_remove_body`, `stg_chair_remove_confirm`, `stg_chair_remove_moderator`, `stg_chair_remove_not_found`, `stg_chair_remove_title`, `stg_conference_chairs`, `stg_device_forget_body`, `stg_device_forget_confirm`, `stg_device_forget_title`, `stg_devices_count`, `stg_filter_all`, `stg_filter_joined`, `stg_filter_missing`, `stg_joined_here`, `stg_kind_account`, `stg_kind_device`, `stg_legend_idle`, `stg_legend_live`, `stg_legend_missing`, `stg_offline`, `stg_on_devices`, `stg_online`, `stg_people_chairs_hint`, `stg_people_filter`, `stg_role_commenter`, `stg_signed_in_chair`, `stg_status_present`, `stg_status_pv`, `stg_unnamed_account`. Net -20 per locale.

**16 Sep 2026, Settings text cut to labels + hints (counted 1549 per locale right after, identical key sets, 0 missing / 0 extra; other sessions were editing too):** in all four locales. REMOVED `stg_hover_reveal` (the chair password ticket shows an eye glyph; its purpose is the ticket tooltip), `settings_view_only_note` (the view-only banner already says Commenter), `stg_limit_none`, `stg_limit_some` (the documents card shows `stg_limit_label` beside the No limit chip). SHORTENED, same meaning, visible labels now 1-4 words: `settings_chair_approval_label`, `stg_lock_rollcall_label` (en), `settings_gsl_require_next_label`, `settings_gavel_sound_label`, `settings_cow_timer_label`, `settings_require_doc_approval`, `settings_allow_abstentions_label` (also read by `VotingRulesPanel` and `PreVoteScreen`: now "Allow abstentions"), `settings_points_rate_label`, `settings_substantive_threshold`, `stg_people_delegates`, `stg_chair_devices`, `stg_on_devices` (en/es/fr), `stg_awards_card_title`, `settings_section_quorum` (en/es/fr no longer all caps). The six tab leads `stg_access_desc`, `stg_motions_desc`, `stg_voting_desc`, `stg_points_desc`, `stg_people_desc`, `stg_awards_desc` are one short sentence each. Hover hints shortened: `settings_chair_approval_note`, `settings_allow_abstentions_note`, `settings_gavel_sound_note`, `settings_points_rate_note`, `settings_require_doc_approval_note`, `settings_doc_names_desc`, `stg_p5_fixed_hint`, `stg_custom_motion_hint`; status lines `stg_p5_none_seated`, `stg_p5_some_seated` (`{n}` kept) and `stg_awards_card_body`. Rule for this dialog: a new explanation goes into a hint key rendered by `InfoHint`, never under a label. Net -4 per locale.

**16 Sep 2026, document-first introduction screen (not recounted: other sessions were adding keys at the same time):** in all four locales. REMOVED `documents_hide_doc`, `documents_show_doc` (the document is always shown now) and `documents_go_to_voting` (the full-width DR banner is gone; the small Vote button stays). Added 13 keys × 4 locales where `documents_hide_doc` / `documents_show_doc` were: `documents_timer_panel`, `documents_timer_move`, `documents_timer_resize`, `documents_timer_hide`, `documents_timer_show`, `documents_timer_reset_title`, `documents_stage_back_title`, `documents_stage_skip_title`, `documents_pause_btn` (replaces a hardcoded "PAUSE"), `documents_zoom_in`, `documents_zoom_out`, `documents_zoom_reset`, `documents_no_content` (replaces hardcoded English "No document content saved"). The old hardcoded "Back" / "Reset timer" / "Skip" tooltips now use the `_title` keys. No placeholders. `IntroTimerPanel` strips "▶ " from `documents_resume_btn` and " →" from `documents_start_btn` because it draws icons. Net +10 per locale.

**16 Sep 2026, inline seat field beside the quorum tabs (not recounted):** in all four locales, in the `rollcall_add_seat_*` block. REMOVED `rollcall_add_seat_search`, `rollcall_add_seat_present_note`, `rollcall_add_seat_close`, `rollcall_add_seat_done` (the picker dialog is gone). Added `rollcall_add_seat_field` (the field's accessible name), `rollcall_add_seat_hint` (its tooltip: Enter / Shift+Enter), `rollcall_add_seat_added_observer` (`{country}`). `rollcall_add_seat` is now the field's placeholder; `_custom`, `_observer`, `_empty`, `_added` are reused by `src/components/SeatAddField.tsx`. `rollcall_topic` is now the visible, non-editable "Topic:" label in the sidebar masthead (`CommitteeIdentityBadge`), and `rollcall_observer` also names the observer badge on a flag outside roll call. Net -1 per locale.

**16 Sep 2026, roll call + button and quorum capsules (not recounted: other sessions were adding keys at the same time):** in all four locales. REMOVED `rollcall_filter_placeholder` (the filter / add field is gone). Added 9 keys × 4 locales in its place: `rollcall_add_seat` (the + button label and the dialog title), `rollcall_add_seat_search`, `rollcall_add_seat_custom` (`{name}`), `rollcall_add_seat_observer`, `rollcall_add_seat_empty`, `rollcall_add_seat_present_note`, `rollcall_add_seat_added` (`{country}`), `rollcall_add_seat_close`, `rollcall_add_seat_done` (`AddSeatPicker` / `AddSeatButton` in `RollCallPanel.tsx`). RENAMED `identity_observers_excluded` → `identity_observers_counted` with new text in all four (observers now count in the quorum read-out, and stop counting at the final vote); it is the tooltip of `QuorumRings`. `rollcall_observer` is now also the word under an observer's megaphone in roll call. Net +8 per locale.

**15 Sep 2026, People tab review fixes:** added 2 keys × 4 locales after `stg_chair_remove_moderator`: `stg_chair_remove_not_found` (People → remove a chair whose name was already gone; `remove_session_chair` answers `not_found`) and `stg_kick_reserved` (shown in place of the Remove button on a reserved conference seat held by its allocated account, and as the sheet message when `kick_delegate_seat` answers `reserved`). No placeholders.

**16 Sep 2026, Settings condensed (Access dais avatars, no Add source):** added 5 keys × 4 locales where `stg_see_people` was (removed, no reader left): `stg_dais_hint`, `stg_dais_empty`, `stg_chair_state_commenting`, `stg_chair_state_viewing`, `stg_chair_state_offline`. Removed `settings_points_add_source` × 4 (the button is gone). Reworded `settings_points_sources_desc` × 4 (no longer says "add your own"), and took the em dashes out of en `settings_allow_abstentions_note`, en and ar `settings_points_rate_note`.

**15 Sep 2026, Settings dialog redesign + People tab (counted 1455 keys per locale at the time, identical key sets; other sessions were adding keys too):** added 151 `stg_*` keys × 4 locales, placed after `settings_updated_by_other_chair` (tab titles and descriptions, section headers, control labels and aria text, the People tab, the Awards tab and its screen-share confirm; `src/components/SettingsPanel.tsx` and `src/components/settings/*`), and 2 keys × 4 locales after `delegate_seat_elsewhere_body`: `delegate_seat_kicked_title`, `delegate_seat_kicked_body` (`{country}`, the delegate page after a chair removes the seat). Placeholders: `{name}`, `{n}`, `{total}`, `{country}`, `{docs}`, `{live}`, `{idle}`, `{missing}`, `{objective}`, `{quality}`, each once per string. Hardcoded English that the old panel carried (Sponsors label, Lock delegate roll call, Disable chat, Timer duration, submission limits, the P5 and Custom motion hints) now goes through `stg_*` keys. Existing `settings_*` keys still read: tab labels for Motions / Voting / Points, the voting, veto, quorum, documents, gavel-sound and points strings. Language picker labels (EN / ES / FR / ع) are hand-maintained in `SettingsPanel.tsx`.

**15 Sep 2026, chat attachments and GIFs (not recounted: other sessions work was adding keys at the same time):** added 15 keys × 4 locales, placed after `chat_close`: `chat_attach`, `chat_photo`, `chat_attach_uploading` (`{n}`), `chat_attach_ready`, `chat_attach_remove`, `chat_attach_too_big`, `chat_attach_bad_type`, `chat_attach_failed`, `chat_attach_open`, `chat_pdf_open`, `chat_gif`, `chat_gif_search`, `chat_gif_empty`, `chat_gif_failed`, `chat_gif_close`. Hand-maintained bypass: "Powered by GIPHY" in `src/components/chat/GifPicker.tsx` stays English in every locale (GIPHY's required attribution), and the "GIF" / "PDF" badges are not translated. `chat_close` is now read by `ChatDialog` (the outside close button) rather than the list header.

**16 Sep 2026, join page redesign (not recounted: other sessions work was adding keys at the same time):** added 41 keys × 4 locales, placed after `join_incorrect_code`: `join_hero_title`, `join_hero_accent`, `join_hero_sub`, `join_bullet_flags`, `join_bullet_live`, `join_bullet_signin`, `join_code_label`, `join_code_hint`, `join_checking`, `join_retry`, `join_found`, `join_stage_empty_title`, `join_stage_empty_body`, `join_seat_search`, `join_seat_clear`, `join_seat_none`, `join_roster_empty`, `join_seats_open` (`{open}`, `{total}`), `join_observer`, `join_signin_cta`, `join_signin_prompt`, `join_signin_why`, `join_signed_in_as` (`{name}`), `join_nav_create`, `join_chair_code_label`, `join_chair_code_placeholder`, `join_chair_code_prefilled`, `join_chair_name_active`, `join_chair_joining_as` (`{name}`), `join_advisor_note`, `join_conf_eyebrow`, `join_conf_verifying`, `join_conf_verified`, `join_conf_locked` (`{country}`), `join_conf_signin_title`, `join_conf_signin_body`, `join_conf_not_linked_title`, `join_conf_not_linked_body`, `join_conf_signin_other`, `join_conf_stuck`, `join_not_linked`, `join_btn_as` (`{country}`). They replace English literals that were hardcoded in `src/app/join/page.tsx`. The page strips the arrow glyph from `join_btn_delegate` / `_ended` / `_chair` / `_advisor` and draws an icon, and strips the leading "+ " from `join_new_name`. `join_create_link`, `join_title`, `join_subtitle` and `join_seat_signin` are no longer read by the join page (left in place).

**Last counted 15 Sep 2026, after the chat redesign:** **1241 keys per locale** at the time of counting (other workstreams added keys the same day), identical key sets in all four (0 duplicates). Added 21 keys × 4 locales, placed after `chat_everyone_info`: `chat_search`, `chat_search_label`, `chat_no_results`, `chat_section_start`, `chat_new_group`, `chat_group_name`, `chat_group_name_placeholder`, `chat_group_members`, `chat_group_selected` (`{n}`), `chat_group_create`, `chat_group_cancel`, `chat_group_member_count` (`{n}`), `chat_group_info`, `chat_group_created` (`{name}`), `chat_group_failed`, `chat_group_hint`, `chat_back`, `chat_close`, `chat_everyone_subtitle`, `chat_dais_subtitle`, `chat_dais_shared_info`. Reworded `chat_thread_info` in all four so it no longer promises that only the two people can see a DM (every device downloads every message). The old DM picker went away, so `chat_new_message`, `chat_new_message_btn`, `chat_co_chairs`, `chat_delegates`, `chat_send_first`, `chat_no_conversations` and `chat_no_conversations_hint` are now unread; they were left in place (not deleted) to keep this change small.

**Last counted 15 Sep 2026, after the review fixes:** **1210 keys per locale**, identical key sets in all four (0 duplicates). This count supersedes the two "not recounted" entries below. Removed 2 keys × 4 locales: `chair_hdr_copy_code`, `chair_hdr_copied` (nothing read them after the top-bar code button started presenting the code; the "chair floor" entry below still names `chair_hdr_copied` as its insertion point, which now means right after `chair_hdr_chat_unread`). Added 1 key × 4 locales, placed after `voting_proceed_rights`: `voting_continue` (the neutral "Continue" on the all-voted screen of `/voting/[code]` while the tally is hidden, so it does not reveal whether anyone voted with rights). Net -1 per locale.

**15 Sep 2026, collapsible flag column and quorum tabs (not recounted: other sessions work was adding keys at the same time):** in all four locales. RENAMED `identity_two_thirds` → `identity_tab_two_thirds` and `identity_majority` → `identity_tab_majority`, now the literal tab labels `2/3` and `1/2+1` in every locale (`QuorumRings.tsx`; the old word values had no other reader). Added 3 keys × 4 locales after `sidebar_expand`: `sidebar_rail_label` (the collapsed column's nav name), `sidebar_rail_item` (`{country}`, `{n}`), `sidebar_rail_more` (`{n}`) (`SidebarFlagRail.tsx`). Net +3 per locale.

**15 Sep 2026, speaker controls round 2 (not recounted: other sessions work was adding keys at the same time):** added 5 keys × 4 locales, placed after `speaker_ctl_rtr_title`: `speaker_ctl_rtr_short` (the caption under the Right of Reply icon: RTR / DR / DR / رد), `speaker_clock_start`, `speaker_clock_pause` (aria-label and tooltip of the clickable countdown, `SpeakerClock` in `src/components/SpeakerControls.tsx`), `popover_drag_handle`, `popover_close` (`src/components/DraggablePopover.tsx`, the movable RTR and Add time popovers). `gsl_add_time` is now only the aria-label of the icon-only Add time button.

**16 Sep 2026, chair floor round 4 (not recounted: other sessions work was adding keys at the same time):** added 1 key × 4 locales, placed after `speaker_ctl_call_first_title`: `speaker_ctl_on_deck_start` (`{country}`, tooltip of the unavailable Next while a delegation is on deck). REMOVED 3 keys × 4 locales from round 3: `gsl_quick_add`, `gsl_queue_count`, `caucus_spoke_count` (quick-add chips and strip header counts are gone). Reworded in all four: `speaker_ctl_need_speaker` ("Nobody is speaking yet."), `gsl_add_call_first` ("Add delegates below to start the list."). `gsl_call_first` is no longer read by any code. Hand-maintained bypass: the tutorial's `call-first-speaker` step copy in `TutorialOverlay.tsx` now names Start.

**16 Sep 2026, chair floor round 3 (not recounted: other sessions work was adding keys at the same time):** added 7 keys × 4 locales, placed after `gsl_time`: `gsl_full_name` (the strip header, "General Speaker's List"), `gsl_on_deck` (the delegation on deck), `gsl_quick_add` (quick-add chips in the add bar), `gsl_queue_count` (`{n}`), `gsl_time_preset_title` (`{n}`), `gsl_time_custom`, `caucus_spoke_count` (`{n}`, caucus strip header). `gsl_no_current_speaker` is no longer read by the chair page.

**15 Sep 2026, chair floor (not recounted: other sessions work was adding keys at the same time):** added 23 keys × 4 locales, placed after `chair_hdr_copied`: `chair_hdr_show_code` (`{code}`, the top-bar code button now presents the code); `code_present_title` (`{code}`), `code_present_eyebrow`, `code_present_join_at`, `code_present_copy`, `code_present_copied`, `code_present_close`, `code_present_qr` (`{url}`), `code_present_hint` for `src/components/SessionCodePresenter.tsx`; `speaker_ctl_need_speaker`, `speaker_ctl_restart`, `speaker_ctl_next_title`, `speaker_ctl_call_first_title`, `speaker_ctl_list_empty`, `speaker_ctl_queue_empty`, `speaker_ctl_below_quorum`, `speaker_ctl_add_time_title`, `speaker_ctl_rtr_title` for the always-visible speaker buttons (`src/components/SpeakerControls.tsx`, tooltips of unavailable controls); `speaker_remove_current` (`{country}`, the X on the floor speaker in the top strip, the caucus floor and the sidebar row); `gsl_move_speaker` (`{country}`), `gsl_drag_hint`, `gsl_remove_speaker` (`{country}`) for `src/components/SpeakerStrip.tsx`. `chair_hdr_copy_code` / `chair_hdr_copied` are no longer read by the chair page. `SpeakerControls` strips the legacy glyphs from `gsl_start` ("▶") and `gsl_next` ("→" / AR "←") because it draws icons, and joins the two lines of `gsl_add_time`.

**15 Sep 2026, sidebar polish (not recounted: other sessions work was adding keys at the same time):** in all four locales, placed where `rollcall_pv_tag` / `rollcall_pv_full` were, which are REMOVED (outside roll call Present and Present-and-Voting rows now look identical, so the tag is gone). Added 10 keys × 4 locales: `rollcall_list_label` (the focusable list), `rollcall_reorder_handle` (`{country}`), `rollcall_reorder_hint` (the queue grip, `RollCallPanel.tsx`); `identity_topic_edit`, `identity_topic_add`, `identity_topic_field`, `identity_topic_failed`, `identity_topic_switch` (inline topic editing and the agenda switch in `CommitteeIdentityBadge.tsx`); `sidebar_collapse`, `sidebar_expand` (the collapsible chair sidebar). Net +8 per locale.  
**Last counted 15 Sep 2026, after the chair sidebar and top bar redesign:** **1134 keys per locale**, identical key sets in all four (0 duplicates). Added 19 keys × 4 locales, placed after `chair_hdr_settings`: `chair_hdr_controls`, `chair_hdr_tab_count` (`{label}`, `{n}`), `chair_hdr_copy_code` (`{code}`), `chair_hdr_copied`, `chair_hdr_chat_unread` (`{n}`) for the top bar (`src/components/ChairTopBar.tsx`, chat is an icon now); `identity_quorum_group`, `identity_present`, `identity_two_thirds`, `identity_majority`, `identity_present_aria` (`{n}`, `{total}`), `identity_two_thirds_aria` (`{n}`), `identity_majority_aria` (`{n}`), `identity_observers_excluded`, `identity_quorum_met`, `identity_quorum_needs` (`{n}`) for the labelled quorum rings (`src/components/QuorumRings.tsx`); `rollcall_speaking`, `rollcall_pv_tag` (ES/FR/AR reuse the P+V / PV / ح+م abbreviations of `rollcall_all_pv`), `rollcall_pv_full`, `rollcall_queue_position` (`{n}`) for the sidebar rows. The three ring labels are kept to one short word each (the cells are ~80px wide at the minimum sidebar width).  
**Last counted 15 Sep 2026, after Free seat removal and the delegate idle logout:** **1115 keys per locale**, identical key sets in all four (0 duplicates). Removed 3 keys × 4 locales, `rollcall_seat_free`, `rollcall_seat_free_confirm`, `rollcall_seat_free_failed` (the chair's Free seat control in `RollCallPanel.tsx` is gone). Added 4 keys × 4 locales: `delegate_idle_title`, `delegate_idle_body` (`{time}`, m:ss), `delegate_idle_im_here` (the "Still there?" warning, `src/components/delegate/DelegateIdleWarning.tsx`, placed after `delegate_seat_switch_account`) and `join_idle_signed_out` (`{country}`, the join-page notice after `/delegate/[code]` signs a device out, read from `?idle=`). Rewrote 3 existing strings × 4 locales that told people to "ask the chair to free it": `join_seat_taken_note`, `join_seat_now_taken`, `delegate_seat_taken_body` now say a seat opens again after an hour without activity.  
**Last counted 14 Sep 2026, after all four session-fix streams landed (integration pass):** **1114 keys per locale**, identical key sets in all four (0 missing / 0 extra, 0 duplicate keys), up from 1056: +6 session sync, +5 save toast / clock skew, +31 votes / settings, +16 motions / documents / Finish. Placeholders match across locales for every new key; no em dashes in any new string.  
**Added 14 Sep 2026 (session sync / connection pill):** 6 keys × 4 locales: `conn_live`, `conn_reconnecting`, `conn_offline`, `conn_offline_hint`, `conn_reconnecting_hint` (the Live / Reconnecting / Offline pill, `src/components/ConnectionPill.tsx`, on the chair, delegate and advisor pages; placed after `gavel_chair_offline`) and `join_lookup_failed` (join page, when the code lookup fails on the network rather than finding nothing; placed after `join_not_found`). Counted while other sessions work was also adding keys: **1114 keys per locale**, identical in all four.  
**Last counted 14 Sep 2026, after one device per chair account:** **1056 keys per locale**, identical in all four.  
**Changed 15 Sep 2026 (voting page redesign):** net +45 keys × 4 locales, all in the voting block where `voting_correct_*` used to sit. Removed `voting_correct_open`, `voting_correct_heading`, `voting_correct_none` (the Correct-a-vote list is gone). Renamed `voting_correct_for|for_rights|abstain|against_rights|against` to `voting_choice_*` and added `voting_choice_pass`. Added `voting_step_back`, `voting_step_back_title`, `voting_step_back_to_ballot`, `voting_keep_vote`, `voting_recorded_choice` (`{choice}`), `voting_recorded_hidden`, `voting_hdr_back`, `voting_hdr_back_title`, `voting_hdr_settings`, `voting_hdr_end`, `voting_role_following` (`{name}`), `voting_stage_voting|pass|rights|tallied|result`, `voting_pick_*` (eyebrow, title/empty_title with `{doc}`, sub, sub_follow, empty_body, status_ready|live|passed|failed, start, resume, view, follow, not_started, no_sponsors, more `{n}`, tally `{for}`/`{against}`), `voting_prevote_for_doc` (`{code}`), `voting_prevote_close`, `voting_prevote_done`, `voting_prevote_tab_abst_off|counted|excluded`, `voting_summary_counted` (`{counted}`/`{needed}`), `voting_summary_counted_consensus`, `voting_summary_quorum`, `voting_result_simple`, `voting_result_quorum_not_met`, `voting_result_abst_counted` (these three replace hardcoded English on the result screen). The header's Moderator chip reuses `gavel_chairing_badge`. `voting_up_next`, `voting_back_to_session`, `voting_select_doc`, `voting_back_docs`, `voting_no_introduced_docs`, `voting_resume_vote`, `voting_vote_live_badge` now have no reader anywhere in `src/` (left in place for a cleanup pass). Concurrent work changes the total; recount before quoting it.

**Added 15 Sep 2026 (session load retry):** 1 key × 4 locales, `session_load_failed`, placed after `session_access_error_body`. Shown with a `delegate_seat_retry` button by `/chair`, `/delegate`, `/advisor` and `/voting` when the initial room read failed three times (`getCommitteeByCodeWithRetry` in `committeeService.ts`), instead of "session not found".

**Added 15 Sep 2026 (session access retry):** 2 keys × 4 locales, `session_access_error_title` and `session_access_error_body`, placed after `delegate_seat_retry` (which the screen reuses for its button). Shown by `/chair`, `/voting` and `/advisor` when the conference access check could not be answered on a first load (`src/lib/useSessionAccess.ts`). Concurrent work on this branch changes the total; recount before quoting it.  
**Removed 14 Sep 2026 (side panel):** 3 keys × 4 locales, `rollcall_az`, `rollcall_queue` (the A-Z / QUEUE toggle is gone; the panel is always the queue, plain A-Z only during roll call) and `rollcall_seat_claimed_title` (the claimed-seat phone icon is gone). The tutorial step `sidebar-view-toggle` and its four hand-written locale bubbles in `TutorialOverlay.tsx` went with the toggle. Counted after this removal and a concurrent seat change that added 3 `delegate_seat_*` keys: **1041 keys per locale**, identical in all four.  
**Last updated after:** seat gating review fixes — 2026-09-11 (EN/ES/FR/AR; ar = RTL; **1041 keys per locale**). Added 1 key, `delegate_seat_switch_account`, the reserved-seat screen's button when the wrong account is signed in. See "Recent changes" at the bottom.  
**Previously:** open conference seats and one person per seat — 2026-09-11 (EN/ES/FR/AR; ar = RTL; **1040 keys per locale**). Added 21 keys: 7 `join_seat_*` for the join-page seat picker, 10 `delegate_seat_*` for the delegate page's seat-guard screens, 4 `rollcall_seat_*` for the chair's Free seat control. See "Recent changes" at the bottom.  
**Previously:** gavel knock timer sound — 2026-09-11 (EN/ES/FR/AR; ar = RTL; **1019 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 7 keys for the Settings → Access → Timer sound group (`settings_section_timer_sound`, `settings_gavel_*`). See "Recent changes" at the bottom.  
**Previously:** setting the agenda — 2026-09-11 (EN/ES/FR/AR; ar = RTL; **1012 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 10 `agenda_*` keys for the chair's agenda picker on conference committees with 2 or 3 topics (`src/components/AgendaPicker.tsx`). Note: the file held 1002 keys before this change, not 1000. See "Recent changes" at the bottom.  
**Previously:** qualitative scoring, notes and the score blend — 2026-09-07 (EN/ES/FR/AR; ar = RTL; **1000 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 10 keys so the SUBJECTIVE half of the scoreboard is finally visible and a chair note carries its context: `sb_matrix_quality`, `sb_matrix_legend`, `sb_stat_quality`, `sb_title_quality`, `sb_quality_unrated`, `sb_comment_level_speech`, `sb_comment_level_session`, `sb_comment_level_conference`, `sb_comment_written`, `fb_tag_tour`. Two existing tooltips were rewritten (`sb_matrix_manual_title`, `sb_matrix_points_title`). See "Recent changes" at the bottom.  
**Previously:** conference awards signposts — 2026-09-05 (EN/ES/FR/AR; ar = RTL; **990 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 4 keys for the award signposts on the chair session (`sb_awards_link`, `chair_ended_awards_title`, `chair_ended_awards_body`, `chair_ended_awards_cta`), all rendered ONLY when `committee.sessionOrigin === 'conference'`. Note: the file already held 986 keys before this change; the 875 figure below was stale. See "Recent changes" at the bottom.  
**Previously:** delegate rail micro-labels — 2026-08-13 (EN/ES/FR/AR; ar = RTL; **875 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 5 `delegate_*` micro-label keys for the narrow rail beside the flag: the roll-call and queue captions plus the two-line variants of the three stat labels. See "Recent changes" at the bottom.  
**Previously:** redesigned delegate view — 2026-08-13 (870 keys). Added 17 `delegate_*` keys for the rebuilt delegate Session view: queue-position header, speakers-ahead / ETA lines, the 3-tile stat strip, the YOU / SPEAKING chips, and the two bottom-sheet titles.  
**Previously:** delegate score-gap tips — 2026-08-07 (853 keys). The 44-key `delegate_tip_*` corpus was rebuilt around the committee's real scoring sources: 13 keys deleted, 17 rewritten to interpolate chair-renameable document/motion names, 2 added, and **all 33 survivors are now reachable** — no orphans left.  
**Previously:** resume-failure copy — 2026-08-07 (864 keys). Added 5 `session_resume_*` keys for the resume-deadlock failure paths plus `session_suspended_banner`.  
**Previously:** GavelChip i18n — 2026-08-06 (858 keys). Added 12 `gavel_*`, 5 `join_chair_role_*` and 3 `settings_view_only_*` keys, translating `GavelChip.tsx` end-to-end, the join-page chair role picker (whose co-chair copy was factually stale) and the SettingsPanel view-only notice.  
**Previously:** i18n loose-ends close-out — 2026-08-06 (838 keys). Wired the `{wp}` / `{dr}` call sites in `calcPoints`, added `settings_head_chair_label` / `settings_head_chair_note`, and fixed a duplicate-`{s}` render bug in ES/FR `delegate_status_changes_left`.  
**Previously:** i18n debt sweep — 2026-08-06 (836 keys). Added 45 `voting_rules_*` keys for `VotingRulesPanel`, rewrote `settings_allow_abstentions_note` (it asserted behaviour that `abstentionsInDenominator` now makes configurable), deleted 14 dead `wp`/`dr` document keys, and gave `delegate_tip_no_docs` / `delegate_tip_have_wp` `{wp}` / `{dr}` placeholders.  
**Previously:** conferences-auth merge — 2026-07-09 (794 keys). Merged in 7 conferences-branch settings keys (`settings_code_hint`, `settings_custom_id_label`, `settings_custom_id_note`, `settings_separate_chair_code_label`, `settings_separate_chair_code_note`, `settings_multi_chairs_label`, `settings_multi_chairs_note`) with new FR/AR values, and filled a pre-existing AR gap for the 4 `settings_veto_custom_*` keys.  
**Reference implementation:** Spanish (ES) first, French (FR) second, Arabic (AR, RTL) third — use as guides.  
**Keep this file current:** whenever strings, locales, or the workflow change, update this doc in the same change. This is the single source of truth — do not maintain a parallel agent file for it.

---

## INFRASTRUCTURE

- **Supabase project:** `luruhkwrgisytejswlas` (us-west-2)
- **Repo:** `github.com/MrCoolZakhar/debate.com`
- **Deploy branch:** `claude/muncommand-recreation-9yjin` → auto-deploys to gavelling.com via Vercel
- **UI/feature branch:** `ui/forest-ivory-redesign` → Vercel preview URL
- **Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Supabase

**Workflow:** Always work on `ui/forest-ivory-redesign`. Run `npm run build` before every commit. Commit and push after each step.

---

## LANGUAGE SYSTEM ARCHITECTURE

| File | Purpose |
|------|---------|
| `src/lib/translations.ts` | Full EN/ES/FR/AR dictionary (1056 keys per locale). New language block goes here. `Language` type is also here. |
| `src/lib/delegateTips.ts` | `selectDelegateTips()` — picks which `delegate_tip_*` keys a delegate sees, and fills their `{wp}` / `{dr}` / `{mod}` / `{unmod}` / `{tour}` / `{end}` / `{source}` vars. The ONLY consumer of that corpus. |
| `src/contexts/LanguageContext.tsx` | `LanguageProvider`, `useLanguage()`, `useT()` hooks, localStorage persistence. |
| `src/app/layout.tsx` | Wrapped in `LanguageProvider`. |
| `src/lib/countries.ts` | `COUNTRY_NAMES_ES`, `COUNTRY_NAMES_FR`, `getCountryDisplayName()`, `matchesCountryQuery()`, `startsWithCountryQuery()`. |
| `src/lib/presetNames.ts` | `PRESET_NAME_ES`, `PRESET_NAME_FR`, `getCommitteeDisplayName()` for preset committee names. |
| `src/lib/docNames.ts` | `docName()` — the single resolver for the chair-renameable Working Paper / Draft Resolution labels (see rule 5b). |
| `src/app/create/page.tsx` | `PRESET_ACRONYM_ES`, `PRESET_ACRONYM_FR`, `getPresetAcronym()` for committee acronyms in search dropdown. |
| `src/components/SiteNav.tsx` | `NAV_LINKS_CONFIG` — needs a language key per entry. Globe dropdown language toggle. |

**Translation hook usage:**
```tsx
import { useT, useLanguage } from '@/contexts/LanguageContext';
const t = useT();
const { language, setLanguage } = useLanguage();
t('key_name')
t('key_with_var', { n: count })
```

**Interpolation convention.** Placeholders are `{name}` and are substituted by `t(key, vars)` in `LanguageContext`. Notes that bind every locale:

- Substitution is `String.replace` per variable, so **each placeholder is replaced once only**. A key that needs the same value twice must take two differently-named vars.
- Every placeholder present in the `en` value must be present in `es` / `fr` / `ar` too. The audit script in section A checks this.
- **Word order is the translator's, not English's.** Put the placeholder where the target language wants it — especially in `ar`, where `{present} حاضرون من {total}` reads right-to-left as one unit. Never append an English-shaped fragment (` — {n} required`) onto a translated stem; write the whole sentence as one key instead. That is why the quorum line is three complete keys (`voting_rules_quorum_line_none` / `_required` / `_not_met`) rather than a stem plus suffixes.
- Standard names in use: `{n}` (count), `{doc}` / `{wp}` / `{dr}` (document type names — see rule 5b), `{present}` / `{total}` / `{needed}` / `{cast}` / `{eligible}` (voting maths), `{current}` (index), `{code}`.
- There is **no plural engine**. English pluralisation is done with two separate keys (`voting_rules_abstentions_kept_one` / `_other`) chosen by a `=== 1` check at the call site. Do not smuggle an `{s}` suffix placeholder into new keys — three legacy keys (`delegate_status_changes_left`, `delegate_after_speakers`, `session_hours_until_delete`) still carry one in `en`, and the other locales drop it or absorb it into a natural plural, which is why the audit reports a benign placeholder mismatch on exactly those three.
- **Single-replace is a real hazard, not a theoretical one.** ES/FR `delegate_status_changes_left` used to carry `{s}` **twice** (`{n} cambio{s} de estado restante{s}`); the call site (`delegate/[code]/page.tsx:1498`) does one `.replace('{s}', …)`, so ES and FR rendered a literal `{s}` on screen. Fixed 2026-08-06 by rewriting both to number-invariant phrasing (`Cambios de estado restantes: {n}` / `Changements de statut restants : {n}`). The audit script now flags any string carrying the same placeholder twice — keep that check.

---

## CRITICAL RULES — NEVER VIOLATE

### 1. DB always stores English
The DB always stores EN strings. Translations happen at render/display time only. Never save a translated string to Supabase.

### 2. Country name translation architecture
- `getCountryDisplayName(enName, language)` — always pass the EN name from DB.
- `matchesCountryQuery(enName, query, language)` — use for ALL country search filters.
- `startsWithCountryQuery(enName, query, language)` — use for prioritised sort in dropdowns.
- These functions must be updated to handle the new language code.

### 3. Committee name translation architecture
- `getCommitteeDisplayName(name, language)` from `src/lib/presetNames.ts`.
- Apply everywhere `committee.name` is rendered.

### 4. `CommitteeNameInput` — display vs commit
In `src/app/create/page.tsx`, when a preset is selected, the stored `committeeName` is the **English name** (for DB). The input displays `getPresetDisplayName(value, language)` — a translated version. The `onChange` handler detects when the user types a translated preset name and converts it back to English before storing. **Never commit a translated name to state or DB.**

### 5b. Document names are chair-renameable — never hardcode "Working Paper" / "Draft Resolution"
Chairs can rename both document types per committee (Settings → Motions → Documents), singular **and** plural. The names live in `CommitteeSettings.documentNames` and are mirrored into the `committees.settings` JSONB.

- **Always** render them through `docName(committee, type, 'singular' | 'plural', fallback)` from `src/lib/docNames.ts`.
- The `fallback` argument is the **translated** built-in default (e.g. `t('documents_working_papers_tab')`), so the locale still wins when there is no rename.
- Strings that embed the name use a `{doc}` placeholder key — `documents_submit_doc_heading`, `documents_submit_new_doc`, `documents_empty_doc`, `documents_doc_flow_auto`, `documents_doc_flow_vote`, `documents_qa_optional_doc`, `delegate_no_docs_submitted`, `delegate_no_docs_floor`, `voting_select_doc`, `voting_next_doc`, `voting_back_docs`, `voting_no_introduced_docs` — filled via `t(key, { doc })`. When adding a locale, keep `{doc}` in the translated sentence.
- A string that names **both** types in one sentence uses `{wp}` and `{dr}` instead: `delegate_tip_have_wp`, `delegate_tip_coordinate_bloc`. Fill them with `t(key, { wp: docName(committee,'working-paper','singular',…), dr: docName(committee,'draft-resolution','singular',…) })`.
- The whole `delegate_tip_*` corpus follows this rule, in both forms: `{wp}` / `{dr}` (singular) and `{wps}` / `{drs}` (plural, used where English would otherwise need an article). All of them are filled in one place — `selectDelegateTips` in `src/lib/delegateTips.ts`. The same rule extends to **motion** names there via `{mod}` / `{unmod}` / `{tour}` / `{end}`, resolved with `motionNames(committee, language)`.
- **Write the translated sentence so it survives a rename.** The substituted name can be any word in any gender, so avoid articles and agreement that depend on it: ES/FR/AR translations of these keys deliberately drop `la`/`un`/`ها` rather than guess. English may keep "a {wp}" because the built-in defaults take it.
- The older fixed keys (`documents_submit_wp_heading`, `documents_empty_wp`, `delegate_no_wps`, `voting_select_dr`, …) were **deleted on 2026-08-06** — see "Recent changes". Do not reintroduce a hardcoded-type-name key.
- **Never** read these names via `getSettings(code)` on the delegate or advisor pages — those pages do not hydrate the settings store from the DB. `docName` reads `committee.dbSettings`, which works on every device.
- This applies to **hardcoded JSX too**, not just `t()` keys. `TutorialOverlay` resolves the four labels once in the component and threads them into `getSteps(language, docs)` — see rule 8.

### 5. Motion names localisation
Motion type names are localised via objects inside each component, NOT via `translations.ts`. These exist in:
- `src/components/MotionsModal.tsx` — `DEFAULT_MOTION_NAMES_LOCALIZED`
- `src/app/delegate/[code]/page.tsx` — `mn` inside `phaseDisplay`
- `src/app/advisor/[code]/page.tsx` — `mn` (delegate card) + `advisorMotionNames` (main page)

Add a `language === 'xx'` branch alongside the existing `language === 'es'` and `language === 'fr'` branches in each.

`src/lib/committeeFlags.ts` also carries `MOTION_NAMES_LOCALIZED` — the DB-backed resolver `motionNames(committee, language)` used by any surface that does not hydrate the settings store. Add an `xx:` block there too, or every motion name silently falls back to English on the delegate/advisor pages **and inside the delegate tips**, which interpolate `{mod}` / `{unmod}` / `{tour}` / `{end}` from it.

### 6. Preset acronyms
`getPresetAcronym(name, lang)` in `src/app/create/page.tsx` uses `PRESET_ACRONYM_ES` and `PRESET_ACRONYM_FR`. Add `PRESET_ACRONYM_XX` for the new language. The ternary that calls it must include `language === 'xx'`.

### 7. Inline ternaries — these files use `language === 'es'` directly
Add `language === 'xx' ? '...' :` branches alongside existing ES branches in:
- `src/app/create/page.tsx`
- `src/app/chair/[code]/page.tsx`
- `src/components/MotionsModal.tsx`
- `src/app/HomeClient.tsx` (uses `const es = language === 'es'` pattern — add `const xx = language === 'xx'` on the next line in every card component)

### 8. TutorialOverlay uses hardcoded JSX strings
`src/components/TutorialOverlay.tsx` has all tutorial step `bubbleText` as inline JSX, selected by the `pick(language, { en, es, fr, ar })` helper. Add a key for the new language to **every** `pick` call. Changes to `translations.ts` alone do NOT affect the tutorial.

Exception: the chair-renameable document names. `getSteps(language, docs)` takes a `DocLabels` object (`wpPlural` / `drPlural` / `wpSingular` / `drSingular`) resolved in the component via `docName(committee, …)` with a `t()` fallback, and the `tab-documents` step interpolates `{docs.*}` in all four locales. **Never** type "Working Papers" / "Draft Resolutions" back into a tutorial bubble.

### 9. NUDGE_MESSAGES in advisor page
Already converted to translation keys — just add the new language keys to `translations.ts`.

### 10. SiteNav NAV_LINKS_CONFIG
`src/components/SiteNav.tsx` has a `NAV_LINKS_CONFIG` array where each entry has `en`, `es`, `fr` keys. Add the new language key to every entry or TypeScript will error (`Language` type used to index it).

### 11. Language type and localStorage
- `src/lib/translations.ts` line 1: expand `Language` type to include the new code.
- `src/contexts/LanguageContext.tsx`: update the localStorage validation `if (saved === 'en' || saved === 'es' || saved === 'fr')` to include the new code.
- `src/contexts/LanguageContext.tsx`: the `t()` function uses `(translations as Record<string, Record<string, string>>)[language]` — this cast is required to handle languages not yet in the `translations` object (before the new block is added in Step 6).

---

## THE COMPLETE ADDITION PROCESS — DO IN THIS ORDER

### Step 1 — Language type + country names + preset names
Files: `src/lib/translations.ts`, `src/contexts/LanguageContext.tsx`, `src/lib/countries.ts`, `src/lib/presetNames.ts`, `src/components/SiteNav.tsx`

- Expand `Language` type.
- Update localStorage validation.
- Add `COUNTRY_NAMES_XX` record (all UN member states in the new language).
- Update `getCountryDisplayName()` with a new `language === 'xx'` branch (curated dict + `Intl.DisplayNames` fallback).
- `matchesCountryQuery` and `startsWithCountryQuery` call `getCountryDisplayName` internally — no changes needed.
- Add `PRESET_NAME_XX` record + update `getCommitteeDisplayName()`.
- Add new language key to every entry in `NAV_LINKS_CONFIG`.

### Step 2 — Inline ternaries (4 files)
Files: `src/app/create/page.tsx`, `src/app/chair/[code]/page.tsx`, `src/components/MotionsModal.tsx`, `src/app/HomeClient.tsx`

For every `language === 'es' ? 'Spanish' : 'English'` ternary that produces visible UI text, add a `language === 'xx' ? 'NewLang' :` branch before the ES branch.

In `HomeClient.tsx`, add `const xx = language === 'xx';` directly after every `const es = language === 'es';` line (6 card components). Use `replace_all: true` to catch all 6 at once.

Also add `PRESET_ACRONYM_XX` and update `getPresetAcronym()` in `create/page.tsx`.

Also update the `CommitteeNameInput` component so the search filter uses `localName`/`localAcronym` variables (not `esName`/`esAcronym`).

### Step 3 — Motion names + TutorialOverlay
Files: `src/components/MotionsModal.tsx`, `src/app/delegate/[code]/page.tsx`, `src/app/advisor/[code]/page.tsx`, `src/app/chair/[code]/page.tsx` (if it has motion names), `src/components/TutorialOverlay.tsx`

Add `language === 'xx'` branch to all motion name objects and all 15 tutorial `bubbleText` ternaries.

### Step 4 — Full `translations.ts` language block
File: `src/lib/translations.ts`

Add a complete `xx: { ... }` block before the `} as const;` closing line. The block must have **exactly the same keys** as the `en` block. Also add `settings_xx: 'LanguageName'` to the `en`, `es`, and `fr` blocks.

Use the ES and FR blocks as structural references — same keys, new values.

### Step 5 — Language toggle UI
Files: `src/components/SiteNav.tsx`, `src/components/SettingsPanel.tsx`, `src/app/create/page.tsx`

All three use the **globe dropdown pattern** (see below). Add the new language option to each dropdown by extending the options array — the dropdowns use a mapped array so adding one entry is sufficient.

---

## LANGUAGE TOGGLE — GLOBE DROPDOWN PATTERN

All language toggles across the app use the same globe dropdown. **Do not use pill sliders or EN/ES/FR inline buttons.** The pattern is:

```tsx
// Trigger button (on light background — SiteNav / create page)
<button onClick={() => setShowLangMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl focus:outline-none" style={{ color: '#1B3828' }}>
  <Globe size={14} strokeWidth={2} />
  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
</button>

// Trigger button (on dark #1B3828 background — SettingsPanel)
<button onClick={() => setShowLangMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl focus:outline-none" style={{ color: '#EED98A' }}>
  <Globe size={14} strokeWidth={2} />
  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
</button>

// Dropdown (same in all locations)
{showLangMenu && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
    <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl"
         style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
      {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['xx', t('settings_xx')]] as [string, string][]).map(([code, label], i) => (
        <div key={code}>
          {i > 0 && <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />}
          <button
            onClick={() => { setLanguage(code as Language); setShowLangMenu(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors focus:outline-none"
            style={{ color: language === code ? '#1B3828' : '#6A5A4A', fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : 'transparent' }}
            onMouseEnter={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>{code.toUpperCase()}</span>
            <span>{label}</span>
            {language === code && <span className="ml-auto" style={{ color: '#B6871F' }}>✓</span>}
          </button>
        </div>
      ))}
    </div>
  </>
)}
```

Each location needs `const [showLangMenu, setShowLangMenu] = useState(false)` added to the component. `Globe` is imported from `lucide-react`.

---

## HERO HEADING — LANDING PAGE FONT SIZES

The hero `<h1>` in `src/app/HomeClient.tsx` uses different `clamp()` font sizes per language because each phrase has a different character count. The h1 is wrapped in a **fixed-height container** on md+ so buttons never shift when language is changed:

```tsx
<div className="w-full mb-5 flex items-end justify-center md:h-[195px]">
  <h1 className="font-black tracking-tight text-white leading-[1.05] text-center md:whitespace-nowrap"
      style={{ fontSize: language === 'fr' ? 'clamp(36px, 8.8vw, 126px)'
                       : language === 'es' ? 'clamp(44px, 11.5vw, 145px)'
                       :                     'clamp(48px, 13.5vw, 165px)' }}>
```

**Rule:** `md:whitespace-nowrap` allows text to overflow the `max-w-2xl` container horizontally (intentional — the heading bleeds edge-to-edge). `md:h-[195px]` = EN single line (165px × 1.05) + buffer. **Never remove this wrapper.** When adding a new language, derive the font size from:

```
font_size_max = EN_max × (EN_char_count / new_char_count)
vw = font_size_at_1440px / 14.4
```

Verify one-line fit at 1024px before committing.

---

## LESSONS LEARNED FROM BUILDING ES AND FR

1. **`git archive` stale ref bug.** Always run `git branch -f ui/forest-ivory-redesign origin/ui/forest-ivory-redesign` before archiving. Without the sync, every zip contains old code.

2. **`ProposerInput` (MotionsModal) — search must use display names.** The `ProposerInput` receives English DB names as candidates. Search must be done against `getCountryDisplayName(c, language)`, not the raw English name. The dropdown must use `top-full mt-1` (opens downward) with `z-50`.

3. **`DocumentsModal SponsorSelect`** — needs both helpers. Sort `startsWith` matches first, then `includes` matches. Use both `startsWithCountryQuery` and `matchesCountryQuery`.

4. **`RollCallPanel AddCountryInput`** — display vs commit. The dropdown shows `getCountryDisplayName(c.name, language)` but `commit(c.name)` saves the English name. Never translate the committed value.

5. **TutorialOverlay strings are hardcoded JSX, not t() keys.** Changes to `translations.ts` alone will not fix the tutorial. The motions tab and documents tab descriptions are inline JSX ternaries.

6. **`CaucusPanel` needs language support.** It is imported and used — it needs `useLanguage` + `getCountryDisplayName`. `SpeakersListPanel` is a dead component, never imported — ignore it.

7. **`DelegateDocCard` and similar sub-components** may not have `useT()`. Any function component that renders status labels, badges, or text strings needs to explicitly call `useT()`. Check sub-components that don't have hooks at the top level.

8. **Hardcoded strings bypass t() entirely.** After adding translations, search for hardcoded English text in JSX that doesn't go through `t()`:
   - Session-ended screens, error states, and loading messages are common offenders.
   - `grep -rn ">[A-Z]" src/app/` to find obvious hardcoded strings.

9. **`NAV_LINKS_CONFIG` must be updated.** Adding a new `Language` type value will cause a TypeScript error on `NAV_LINKS_CONFIG` because it's indexed by `Language`. Always add the new key to every entry.

10. **`LanguageContext` cast is required.** The `t()` function uses a permissive cast so it can fall back to `en` before the new language block is added in Step 4. The cast `(translations as Record<string, Record<string, string>>)[language]` allows this safely.

11. **Hero heading font sizes must be derived, not guessed.** Longer phrases need smaller `vw` values. Use the formula above and always verify at 1024px before calling it done. The fixed-height wrapper (`md:h-[195px]`) ensures buttons don't shift.

12. **Preset acronyms need a separate dict.** `PRESET_ACRONYM_XX` in `create/page.tsx` maps English preset names to their localised acronyms (e.g. NATO → OTAN in FR/ES). The ternary in the dropdown must include `language === 'xx'` to use it.

13. **`CommitteeNameInput` displayValue pattern.** When a preset is selected, `committeeName` stores the English name but the input displays `getPresetDisplayName(value, language)`. The `onChange` must map typed translated names back to their English equivalents before storing. This is critical for search to work across languages.

---

## TERMINOLOGY PROCESS

Before writing any translated strings, confirm MUN-specific terminology with Peter. Terms vary significantly by region and conference tradition.

**Reference: locked terminology for ES and FR**

| English | Español | Français |
|---------|---------|---------|
| Chair / Chairs | Director / Directores | Président / Présidents |
| Head chair | Director principal | Président principal |
| Co-chair | Codirector | Coprésident |
| Gavel | Mazo | Maillet |
| View only | Solo lectura | Lecture seule |
| Faculty Advisor | Faculty Advisor | Superviseur |
| General Speakers List (GSL) | Lista General de Oradores | Liste générale des orateurs |
| Moderated Caucus | Cáucus Moderado | Caucus modéré |
| Unmoderated Caucus | Cáucus No Moderado | Caucus non modéré |
| Committee of the Whole | Consulta de Gabinete (CG) | Consultation de l'assemblée (CA) |
| Tour de Table | Round Robin | Tour de table |
| Working Paper | Hoja de Trabajo | Document de travail |
| Draft Resolution | Proyecto de Resolución | Projet de résolution |
| Right of Reply | Derecho a Réplica | Droit de réponse |
| Point of Order | Punto de Orden | Point d'ordre |
| Speaker | Orador | Orateur |
| Raise a Motion | Proponer una Moción | Proposer une motion |
| Suspend Debate | Suspender Debate | Suspension du débat |
| Adjourn Debate | Cerrar Debate | Clôture du débat |
| 2/3 Supermajority | Mayoría Calificada (2/3) | Majorité des deux tiers (2/3) |
| Speakers Queue | Fila (de oradores) | Liste des orateurs |
| Roll Call | Lista de Asistencia | Appel nominal |
| Present | Presente | Présent |
| Present and Voting | Presente y Votante | Présent et votant |
| Abstention | Abstención | Abstention |
| Amendment | Enmienda | Amendement |
| Sponsor | Patrocinador | Parrain |

---

## DESIGN SYSTEM (for any UI additions like language toggle)

| Token | Value | Usage |
|-------|-------|-------|
| Ivory | `#EDE7D8` | Main background |
| Cream | `#FAF8F3` | Cards, modals, dropdowns |
| Parchment | `#DDD4C0` | Borders, dividers |
| Forest | `#1B3828` | Primary brand, buttons, dark headers |
| Forest Mid | `#2A5A3C` | Hover states |
| Gold (on dark) | `#EED98A` | Text on forest backgrounds |
| Ink | `#1C1410` | Primary text |
| Muted | `#9A8A78` | Secondary text, language code in dropdown |
| Amber | `#B6871F` | Checkmark in dropdown, active state accent |

Typography: `Outfit` for all UI (UPPERCASE for buttons). `DM Mono` for codes/badges/language codes.

---

## ARCHITECTURAL RULES — NEVER VIOLATE

- DB always stores EN — translate at render time only.
- Never use circular flags — always rectangular.
- Never omit `focus:outline-none` on interactive buttons.
- Never place a `useEffect` after an early return.
- Never await DB writes for UI updates — optimistic updates only.
- Never call any hook inside a `.map()` loop.
- Never use the old EN/ES pill slider for language toggle — always use the globe dropdown.
- Never remove `md:h-[195px]` from the hero heading wrapper without re-testing all 4 languages (EN/ES/FR/AR).

---

## MAINTENANCE & AUDIT (run before declaring a locale "done")

### A. Key completeness — `translations.ts`
`en` is canonical (`TranslationKey = keyof typeof translations.en`). Every key must exist in every locale block, same order. Audit script:
```js
// node this against repo root
const fs=require('fs');let s=fs.readFileSync('src/lib/translations.ts','utf8');
s=s.replace(/export type Language[^\n]*\n/,'').replace(/export const translations =/,'module.exports =').replace(/\} as const;/,'};').replace(/export type TranslationKey[^\n]*\n?/,'');
fs.writeFileSync('/tmp/_t.js',s);const T=require('/tmp/_t.js');const en=Object.keys(T.en);
for(const L of ['es','fr','ar']){const k=new Set(Object.keys(T[L]));
  const missing=en.filter(x=>!k.has(x)), extra=[...k].filter(x=>!en.includes(x)), same=en.filter(x=>k.has(x)&&T[L][x]===T.en[x]);
  console.log(`\n${L}: present ${k.size} | MISSING ${missing.length} | EXTRA ${extra.length} | identical-to-EN ${same.length}`);
  if(missing.length)console.log('  MISSING:',missing.join(', '));
  if(extra.length)console.log('  EXTRA:',extra.join(', '));
  same.forEach(x=>console.log('  ~',x,'=',JSON.stringify(T.en[x])));}
// Single-replace hazard: the same placeholder twice in one string renders the second literally.
for(const L of ['en','es','fr','ar'])for(const [k,v] of Object.entries(T[L])){
  const m=String(v).match(/\{[a-zA-Z0-9_]+\}/g)||[]; const dup=[...new Set(m.filter((x,i)=>m.indexOf(x)!==i))];
  if(dup.length)console.log(`  DUPLICATE PLACEHOLDER ${L}.${k}: ${dup.join(',')}`);}
```
- **MISSING** keys are always defects (they render English).
- **identical-to-EN** is only a *candidate* — leave it alone when the value is a genuine cognate (FR/ES: Session, Position, Documents, Motions, Quorum, Abstentions, Consensus, Participant, Absent, Total, Type, Vote, Pause, Tour de Table, Caucus), a symbol/arrow (`A → Z`), an abbreviation (`pts`, `min`, `P+V`), a proper noun / brand (`MUN`, `GAVELLING UNLIMITED`, `— Daniele Vare`), or a language-picker **endonym** (`settings_english='English'`, `settings_spanish='Español'`, `settings_french='Français'` are identical across blocks **on purpose**).

### B. Hardcoded English (bypasses `t()` — the bigger gap)
These never translate in any locale. Scan and key them:
```bash
for f in "src/app/chair/[code]/page.tsx" "src/app/delegate/[code]/page.tsx" \
  "src/app/voting/[code]/page.tsx" "src/app/advisor/[code]/page.tsx" src/components/*.tsx; do
  echo "== $f =="; grep -noE '(placeholder|title|aria-label)="[A-Z][a-z][^"]*"|>[A-Z][a-z]+( [A-Za-z,&—-]+){1,}[<.]' "$f" \
    | grep -vE '\{t\(|\$\{|className|viewBox|GavellingLogo'; done
```

### MUN glossary (translate the concept, not literally)
| EN | ES | FR |
|----|----|----|
| Moderated Caucus | Cáucus Moderado | Caucus modéré |
| Unmoderated Caucus | Cáucus No Moderado | Caucus non modéré |
| Consultation of the Whole | Consulta de Gabinete | Consultation de l'assemblée |
| Tour de Table | Round Robin | Tour de table |
| Right of Reply | Derecho de Réplica | Droit de réponse |
| Faculty Advisor | Asesor de Facultad | Conseiller pédagogique |

### Open backlog (re-run A/B before acting)
- **es:** `join_role_advisor = "FACULTY ADVISOR"` still English → "ASESOR DE FACULTAD".
- ~~**chair `View only`**~~ — CLEARED 2026-08-06. The chair page's crimson "View only · X is chairing" pill was replaced by `GavelChip` (fully keyed); the SettingsPanel notice and its footer now use `settings_view_only` / `settings_view_only_chairing` / `settings_view_only_note`. `grep -rn "View only" src/` returns only a code comment in `GavelChip.tsx`.
- **Hardcoded (no `t()`):** voting `Committee not found`; RollCall `Add custom`, `No speakers queued`; Documents `Proceed with Session`, `Motion to Suspend Debate`, `Proposed by`, `No document content saved.`, `Session is now suspended.`; Settings `Sponsors label`, `Score sources`, `Quality factors`, `Rating scale max`, `Ranking blend` (+ many `title=` tooltips, lower priority).
- **Dead keys** to delete from all 4 blocks: `settings_procedural_threshold`, `settings_amendment_threshold`, `settings_majority_absolute`.
- ~~**Dead `delegate_tip_*` corpus**~~ — CLEARED 2026-08-07. All 33 surviving tip keys are reachable from `src/lib/delegateTips.ts`; the 13 that had no home were deleted. See "Recent changes". **Do not add a `delegate_tip_*` key without a firing rule in `selectDelegateTips`** — that is how the 39-key orphan pile happened.
- **`P5`** is still a bare literal in `VotingRulesPanel` (the veto segment button). It is an accepted cross-locale abbreviation and its `title` tooltip goes through `settings_veto_p5_label`; leave it unless Peter asks otherwise.

---

## RECENT CHANGES

### 2026-09-16 — chat photo viewer (`feature/conferences-auth`) — +9 keys
- Added × 4 locales, placed after `chat_pdf_open`: `chat_image_viewer`, `chat_image_close`, `chat_image_prev`, `chat_image_next`, `chat_image_zoom_in`, `chat_image_zoom_out`, `chat_image_open_original`, `chat_image_counter` (`{i}`, `{n}`), `chat_image_failed`. Read by `src/components/chat/ChatLightbox.tsx`; `chat_you_prefix` and `chat_photo` are now also read by `ChatThread` for the viewer's caption and fallback title.
- `chat_attach_open` ("Open full size") now labels the bubble that opens the in-app viewer, not a new tab; the wording still fits.
- Delegate names beside delegations (chair chat, conference sessions) are people's `profiles.display_name`, shown verbatim in every locale. The " (name)" member-list format and the ", " join are not translated.

### 2026-09-16 — scoreboard redesign: History tab, sortable headers, delegate profile (`feature/conferences-auth`) — +16 keys
- **Added 16 keys × 4 locales**, all directly after `sb_tab_matrix`: `sb_tab_history`; `sb_sort_asc` / `sb_sort_desc` (tooltips on a pressed column header, fed to `ScoreboardLabels.sortAscending` / `sortDescending`); `sb_section_timeline` / `sb_empty_no_timeline` (delegate profile); `sb_hist_empty`, `sb_hist_no_speeches`; segment kinds `sb_hist_seg_gsl` / `_moderated` / `_unmoderated` / `_tour` / `_other`; event phrases `sb_hist_motion_raised`, `sb_hist_right_of_reply`, `sb_hist_award`, `sb_hist_deduct`.
- **The event phrases are lowercase fragments** rendered after a bold delegation name ("France · raised a motion", ES *presentó una moción*, FR *a déposé une motion*, AR *قدّم اقتراحًا*). Keep them fragments; do not capitalise them.
- Segment kinds reuse the existing session vocabulary: caucus = ES *cáucus*, FR *caucus*, AR *جلسة تشاور موجّهة / غير موجّهة* (matching `fb_tag_unmod` *غير موجّه*); the Tour de Table matches `fb_tag_tour` (ES *Ronda de intervenciones*, FR *Tour de table*, AR *جولة المتحدثين*).
- `sb_sort_by` and `sb_sort_comments` are no longer rendered by the chair's scoreboard (the sort pills are gone); kept, not deleted, while other workstreams are mid-edit in this file.
- No em dashes, no duplicated placeholders; none of the new keys take a placeholder.

### 2026-09-15 — queue full as a notification (`feature/conferences-auth`) — +2 keys
- **Added `caucus_queue_full_title` / `caucus_queue_full_body`** in all four locales, directly after `caucus_queue_no_time` (EN *Queue full* / *The caucus has no time left for another speaker.*, ES *Fila llena* / *Al cáucus no le queda tiempo para otro orador.*, FR *Liste complète* / *Il ne reste plus de temps au caucus pour un autre orateur.*, AR *الطابور ممتلئ* / *لم يتبقَّ وقت في الحوار لمتحدث آخر.*). They are the title and body of the 3 s top-right notification a full moderated-caucus queue now raises (`notifyCaucusQueueFull`, chair page). Same wording split in two, so the vocabulary is unchanged.
- `caucus_queue_no_time` is no longer rendered anywhere (the sidebar flash and the add-bar replacement are gone); kept, not deleted, while other workstreams are mid-edit in this file.

### 2026-09-15 — voting: pre-vote screen, custom veto picker, hide tally (`feature/conferences-auth`) — +45 keys, −1 key

**Added, 45 keys × 4 locales**, directly after `voting_rules_veto_custom_short` (`voting_veto_exercised` after `voting_veto_seated_list`) in every locale. Count the file before quoting a total: other streams changed it the same day.
- `voting_hide_tally`, `voting_show_tally`, `voting_tally_hidden`: the tally toggle on `/voting/[code]` and the header rules popover.
- 27 `voting_prevote_*` keys: `src/components/voting/PreVoteScreen.tsx` (17 Sep 2026: screen deleted, keys renamed `voting_rc_*` or removed, see the top of this file). Sentences take `{needed}` / `{n}` / `{present}` / `{total}` / `{names}`; `voting_prevote_seg_pv` is the short P+V segment (AR *ح+م*), `voting_prevote_present_voting` its full name. The screen no longer uses `rollcall_pv_tag` / `rollcall_pv_full` (removed by the sidebar stream).
- 15 `voting_veto_*` keys: `src/components/voting/VetoCountryPicker.tsx` and the veto warning in `VotingRulesPanel`, whose previously hardcoded English ("N veto seats are not in this committee…") is now `voting_veto_unseated_one` / `_other` / `_body`, `voting_veto_active_count`, `voting_veto_seated_list`. `voting_veto_exercised` is the result line for a custom veto (P5 keeps `voting_p5_veto`).
- **Deleted** `voting_rules_veto_custom_note` ("edited in Session settings", no longer true). **Rewrote** `voting_rules_veto_info_body` in all four locales to say custom holders are picked with +.

### 2026-09-15 — 15 motions on the floor, drag hint as an "i" (`feature/conferences-auth`) — +3 keys

**Added, 3 keys × 4 locales**, directly after `motions_proposer_has_motion`. Count the file before quoting a total: other changes landed the same day.
- `MotionsModal`: `motions_floor_full` (takes `{n}`, the cap of 15), `motions_more_on_floor` (takes `{count}`, header of the scrolling overflow column), `motions_drag_hint_label` (accessible name of the "i" that now carries `motions_drag_hint`). The ✕ buttons of Motions and Documents reuse `sb_close` as their label.
- Removed (hand-maintained bypasses, not keys): the Custom motion "Informational" badge and the "Accepting this will not change the session" strip with its explainer, all four locales inline in `MotionsModal.tsx`. No translation key was involved, so none was deleted.

### 2026-09-14 — motions in flight, documents flow, Finish (`feature/conferences-auth`) — +16 keys

**Added, 16 keys × 4 locales.** Count the file before quoting a total: other changes landed the same day (1114 after all four streams).
- `src/lib/motionFlight.ts` / `MotionFlightNotice` / `MotionsModal`: `motions_fell_one`, `motions_fell_many` (takes `{count}`), `motions_undo`, `motions_saving`, `motions_save_failed`, `motions_proposer_has_motion` (takes `{country}`).
- `DocumentsModal` and the delegate submit tab: `documents_delete_confirm`, `documents_delete_yes`, `documents_delete_no`, `documents_vote_btn`, `documents_vote_title`, `documents_intro_save_failed`, `documents_submit_failed`.
- Chair page GSL: `gsl_yield` (the FINISH button, upper case like NEXT) and `gsl_yield_title`.

### 2026-09-14 — "Not saved" toast and clock skew hint (`feature/conferences-auth`) — +5 keys

**Added, 5 keys × 4 locales**, directly after `session_resume_lost` in every locale. Count the file before quoting a total: other changes landed the same day.
- `src/components/notifications/SaveStatusToast.tsx` (chair page): `session_save_retrying` ("Not saved. Retrying…"), `session_save_failed` ("Not saved. Check your connection."), `session_save_retry`, `session_save_dismiss` (also the close label of the skew hint).
- `src/components/ClockSkewHint.tsx` (chair page): `session_clock_skew`, takes `{n}` (whole seconds). ES *desfase*, FR *décalée*, AR *منحرفة*; "Timers are corrected" is a statement, not an instruction.

### 2026-09-14 — persisted votes, voting mode, live settings sync (`feature/conferences-auth`) — +31 keys

**Added, 31 keys × 4 locales.** 29 `voting_*` keys directly after `voting_confirm_end`, plus `settings_write_failed` and `settings_updated_by_other_chair` in the same run. Count the file before quoting a total: other changes landed the same day.
- `/voting/[code]` (`src/app/voting/[code]/page.tsx`): `voting_view_only_badge`, `voting_view_only_note`, `voting_follower_waiting` (Commenter view of a vote the Moderator drives); `voting_phase_closed`, `voting_phase_enter_failed`, `voting_phase_leave_failed` (the room's voting mode); `voting_save_failed`, `voting_save_stale`, `voting_save_retry` (a refused ballot write); `voting_resume_vote` and `voting_vote_live_badge` take `{cast}` / `{total}`; `voting_voted_of` takes `{cast}` / `{total}` (replaces the hardcoded "N/M voted"); `voting_follow_live`; `voting_correct_open` takes `{n}`; `voting_correct_heading`, `voting_correct_none`, and the five short choice labels `voting_correct_for`, `_for_rights`, `_abstain`, `_against_rights`, `_against` (one line each in a chip, keep them short); `voting_end_debate_failed`, `voting_end_debate_working`.
- `VotingRulesPanel`: `voting_rules_read_only`.
- `src/components/VotingInProgressCard.tsx` (chair page while `phase === 'voting'`): `voting_in_progress_chair_title`, `voting_in_progress_chair_body`, `voting_in_progress_chair_body_commenter`, `voting_open_screen`, `voting_return_to_debate`.
- `SettingsPanel`: `settings_write_failed`. `src/lib/useSettingsSync.tsx` (chair + voting pages): `settings_updated_by_other_chair`.
- Terminology held: Moderator = ES *Moderador*, FR *Modérateur*, AR *المشرف*, as in `join_chair_role_head`. Rights = ES *derechos*, FR *droits*, AR *حق التعليل*. `voting_view_only_note` and `voting_follower_waiting` receive a `{name}` param that the strings deliberately do not use (the holder's name can be empty).

### 2026-09-14 — one device per signed-in chair account (`feature/conferences-auth`) — 1050 → 1056 keys

**Added, 6 keys × 4 locales**, directly after `gavel_use_this_device` in every locale. Counted after this change: **1056 keys per locale**, identical key sets in all four (0 missing / 0 extra).
- `chair_device_kick_title` (EN *You opened this committee on another device*, ES *Abriste este comité en otro dispositivo*, FR *Vous avez ouvert ce comité sur un autre appareil*, AR *فتحت هذه اللجنة على جهاز آخر*): heading of the blocking modal on `/chair/[code]` and `/voting/[code]` (`src/components/ChairDeviceKickModal.tsx`).
- `chair_device_kick_body`: why (one account chairs from one device at a time).
- `chair_device_kick_use_here` (EN *Use this device instead*): the take-back button. Separate from `gavel_use_this_device` on purpose: this one moves the whole account, not only the gavel.
- `chair_device_kick_leave` (EN *Leave*, ES *Salir*, FR *Quitter*, AR *مغادرة*).
- `chair_device_kick_failed`: shown in the modal when the take-back RPC fails.
- `join_chair_active_elsewhere`: the join page's chair-tab notice when `chair_device_status` says this account is chairing the committee on another live device.
- Terminology held: device = ES *dispositivo*, FR *appareil*, AR *جهاز*; committee = ES *comité*, FR *comité*, AR *اللجنة*.

### 2026-09-14 — extra time capped to the caucus (`feature/conferences-auth`) — +1 key

**Added, 1 key × 4 locales**, directly after `caucus_queue_no_time` in every locale (count the file before quoting a total: other changes landed the same day):
- `caucus_extra_time_capped` takes `{n}` (seconds) (EN *Only {n}s left in this caucus.*, ES *Solo quedan {n} s en este cáucus.*, FR *Il ne reste que {n} s dans ce caucus.*, AR *تبقّى {n} ث فقط في هذا الحوار.*): the 6 s notice in the chair sidebar when +time for a moderated-caucus or Tour de Table speaker is cut down to what the caucus total has left. Caucus = ES *cáucus*, AR *الحوار*, as in `caucus_queue_no_time`.

### 2026-09-14 — one device holds the gavel (`feature/conferences-auth`) — +3 keys

**Added, 3 keys × 4 locales**, directly after `gavel_another_chair` in every locale (count the file before quoting a total: other changes landed the same day):
- `gavel_device_elsewhere` (EN *The gavel is open on another device.*, ES *El mazo está abierto en otro dispositivo.*, FR *Le maillet est ouvert sur un autre appareil.*, AR *المطرقة مفتوحة على جهاز آخر.*): the persistent banner on a chair device whose name holds the gavel on ANOTHER device (`src/components/GavelDeviceBanner.tsx`), the handover toast in that case, and the SettingsPanel view-only notice.
- `gavel_device_elsewhere_short` (EN *Moderating on another device*): the GavelChip label in the same state. One line in the chip, keep it short.
- `gavel_use_this_device` (EN *Use this device*, ES *Usar este dispositivo*, FR *Utiliser cet appareil*, AR *استخدم هذا الجهاز*): the take-back button, in the banner and on the chair's own row in the GavelChip menu.
- Terminology held: ES *mazo*, FR *maillet*, AR *المطرقة*, as in the other `gavel_*` keys. Device = ES *dispositivo*, FR *appareil*, AR *جهاز*.
- The typed add bars' "absent" tag reuses `rollcall_absent`; no new key.

### 2026-09-14 — glass session notifications (`feature/conferences-auth`) — +3 keys

**Added, 3 keys × 4 locales**, directly after `notif_broadcast_end_now` in every locale (count the file before quoting a total: other changes landed the same day):
- `notif_dismiss` (EN *Dismiss*, ES *Descartar*, FR *Ignorer*, AR *إغلاق*): accessible name and tooltip of the x on every card in `src/components/notifications/NotificationStack.tsx`. Previously hardcoded English.
- `notif_more_count` takes `{n}` (EN *+{n} more*, ES *+{n} más*, FR *+{n} de plus*, AR *+{n} أخرى*): the capsule under a collapsed notification deck, and the overflow line when expanded. Previously hardcoded English.
- `notif_show_less` (EN *Show less*, ES *Ver menos*, FR *Afficher moins*, AR *عرض أقل*): folds an expanded deck back.
- **Not keyed on purpose:** the card timestamp ("now", "2 min ago") comes from `Intl.RelativeTimeFormat` in the viewer's locale, so it needs no strings.

### 2026-09-11 — seat gating review fixes (`feature/conferences-auth`) — 1040 → 1041 keys

**Added, 1 key × 4 locales**, directly after `delegate_seat_back` in every locale:
- `delegate_seat_switch_account` (EN *SWITCH ACCOUNT*, ES *CAMBIAR DE CUENTA*, FR *CHANGER DE COMPTE*, AR *تبديل الحساب*). The primary button of the reserved-seat screen in `src/app/delegate/[code]/page.tsx` when someone is ALREADY signed in with an account that is not allocated to the seat: it signs out, then opens sign-in. With nobody signed in the same screen keeps `join_seat_signin`. Uppercase like the other `delegate_seat_*` buttons. No em dashes.

### 2026-09-11 — open conference seats and one person per seat (`feature/conferences-auth`) — 1019 → 1040 keys

**Added, 21 keys × 4 locales**, directly after `join_create_link` in every locale (one block, even though three prefixes are in it, so the whole feature reads in one place):
- `join_seat_taken`, `join_seat_yours`, `join_seat_reserved` are TAGS appended to a country in the join page's native `<select>` as `France · Taken`. Keep them one or two words: they share a line with the country name on a phone.
- `join_seat_taken_note`, `join_seat_reserved_note`, `join_seat_now_taken`, `join_seat_signin` sit under that picker. `join_seat_signin` is also the primary button on two delegate-page screens.
- `delegate_seat_*` are the full-screen stops in `src/app/delegate/[code]/page.tsx` (`SeatGateScreen`): taken, reserved, sign in, open on another device, and could not check. `delegate_seat_taken_body` and `delegate_seat_elsewhere_body` take `{country}` (the localized display name). `delegate_seat_elsewhere_title` / `_body` / `delegate_seat_use_here` are the one-account-one-device stop (`other_device` from `claim_delegate_seat`); the button re-claims with takeover. These replace two hardcoded English screens ("Sign in to join this session", "Allocation does not match account").
- `rollcall_seat_*` no longer exist. `rollcall_seat_claimed_title` was removed on 14 Sep 2026 with the claimed-seat phone icon, and `rollcall_seat_free`, `rollcall_seat_free_confirm`, `rollcall_seat_free_failed` on 15 Sep 2026 with the Free seat control. `delegate_idle_*` and `join_idle_signed_out` are the delegate idle logout (`src/lib/delegateIdle.ts`).
- Terminology: the chair asked to free a seat is the word each locale already uses for "chair" on the join page: ES *director* (`join_create_link` *¿Director?*), FR *président*, AR *الرئيس*. Seat = ES *puesto*, FR *siège*, AR *مقعد*.
- No em dashes, no directional marks in AR, `\'` escapes in FR as elsewhere in the file.

### 2026-09-11 — gavel knock timer sound (`feature/conferences-auth`) — 1012 → 1019 keys

**Added, 7 keys × 4 locales**, directly after `settings_gsl_require_next_note`: `settings_section_timer_sound`, `settings_gavel_sound_label`, `settings_gavel_sound_note`, `settings_gavel_at_label`, `settings_gavel_at_note`, `settings_gavel_pick`, `settings_gavel_test`.

- **Where they render.** Only `src/components/SettingsPanel.tsx`, Access tab, the "Timer sound" group: the on/off toggle, the second-mark quick picks plus a number field, and the Test sound button. The sound itself has no copy.
- **`settings_gavel_pick` takes `{n}`** (a number of seconds) and is the quick-pick chip label: EN `{n}s`, ES/FR `{n} s`, AR `{n} ث` (the same unit as `motions_sec`). The number field's suffix reuses `motions_sec`; no new key.
- Terminology follows the glossary and the gavel keys: Right of Reply = ES *derecho de réplica*, FR *droit de réponse*, AR *حق الرد* (as `gsl_right_to_reply`); Moderator = ES *moderador*, FR *modérateur*, AR *المشرف*; gavel = ES *mazo*, FR *maillet*, AR *المطرقة*.
- No em dashes, no `{s}` suffix, no duplicated placeholder. The AR strings carry no directional marks.

**Verified:** 1019 keys in all four locales, 0 missing / 0 extra, `npx tsc --noEmit` clean for the touched files.

### 2026-09-11 — setting the agenda (`feature/conferences-auth`) — 1002 → 1012 keys

**Added, 10 keys × 4 locales**, directly after `session_suspended_banner`: `agenda_eyebrow`, `agenda_title`, `agenda_subtitle_first`, `agenda_subtitle_switch`, `agenda_hint`, `agenda_current`, `agenda_keep`, `agenda_topic_aria`, `agenda_failed`, `agenda_change_title`.

- **Where they render.** `src/components/AgendaPicker.tsx` (the full-screen picker) and two chair-page tooltips (`agenda_change_title` on the header topic button and on the sidebar masthead's topic button via `CommitteeIdentityBadge` `topicActionTitle`). The picker exists only on conference sessions whose committee has 2 or 3 topics; nothing here reaches a standalone session.
- **`agenda_topic_aria` takes `{n}` and `{topic}`** and is the button's accessible name. `{topic}` is the organiser's text from the DB, shown verbatim in every locale (rule 1: the DB stores what the organiser typed).
- **`agenda_subtitle_first` names roll call** with the same word as `tab_roll_call` in each locale (ES *asistencia*, FR *l'appel*, AR *تدقيق الحضور*).
- Terminology: agenda = ES *agenda*, FR *ordre du jour*, AR *جدول الأعمال*; topic reuses `rollcall_topic` (ES *tema*, FR *sujet*, AR *الموضوع*).
- No em dashes, no `{s}` suffix, no duplicated placeholder. The AR strings carry no directional marks.
- The running count had drifted again: the dictionary held 1002 keys before this change, not the 1000 recorded above.

**Verified:** 1012 keys in all four locales, 0 missing / 0 extra, section A script clean, `npx tsc --noEmit` clean for the touched files.

### 2026-09-07 — qualitative scoring, notes and the score blend (`feature/conferences-auth`) — 990 → 1000 keys

**Added, 10 keys × 4 locales.** Nine sit in the scoreboard cluster: `sb_matrix_quality`, `sb_matrix_legend`, `sb_stat_quality`, `sb_title_quality`, `sb_quality_unrated`, `sb_comment_level_speech`, `sb_comment_level_session`, `sb_comment_level_conference`, `sb_comment_written`, all directly after `sb_matrix_score_title`. One sits in the feedback-dock cluster: `fb_tag_tour`, directly after `fb_tag_caucus`.

**Rewritten, 2 keys × 4 locales.** `sb_matrix_manual_title` and `sb_matrix_points_title` now state that the matrix's ± column is ALREADY INSIDE the Points column. It always was, and the old wording let a chair read it as something to add on top.

- **Why they exist.** `row.quality` reached the screen only through `title=` tooltips and one CSV column, so the only qualitative thing a chair could see was the per-factor bar. `sb_stat_quality` / `sb_title_quality` / `sb_quality_unrated` label it in the ranking drawer; `sb_matrix_quality` gives the Matrix tab a column; `sb_matrix_legend` names all three totals (POINTS, QUALITY, SCORE) in visible text under the table.
- **THREE WORDS THAT MUST STAY DISTINCT IN EVERY LOCALE.** POINTS is the objective ledger total (ES *PUNTOS*, FR *POINTS*, AR *النقاط*). QUALITY is the chairs' factor ratings on a 0 to 100 index and is NOT points (ES *CALIDAD*, FR *QUALITÉ*, AR *الجودة*). SCORE is the blend of the two (ES *PUNTUACIÓN*, FR *SCORE*, AR *النتيجة*, all pre-existing via `sb_col_score` / `sb_stat_points`). Never let a new locale render two of them with the same word — the whole point of this change is that a chair could not tell them apart.
- **`sb_comment_level_*` replace a hardcoded English map.** `COMMENT_LEVEL_LABEL` in `src/lib/conferenceScoreboard.ts` was printing "Speech note" on a surface translated into four locales. It still exists and is still correct for `/manage/**`, which is English by design; the session console now passes translated strings through `ScoreboardLabels`. Same escape-hatch pattern as every other label in `ScoreboardTable.tsx` — do not make that component call `useT()`.
- **`fb_tag_tour` completes the speaking-context vocabulary.** The four context tags are GSL / CAUCUS / UNMOD / TOUR, and the chair's scoreboard now reuses `fb_tag_gsl` / `fb_tag_caucus` / `fb_tag_unmod` / `fb_tag_tour` so a chair reads the identical word while writing a note and while reading it back. `contextLabel` on the organiser live wall (`manage/[slug]/live/LiveModals.tsx`) and `COMMENT_CONTEXT_LABEL` hold the same four words in English. Keep all three in step.
- **`sb_comment_written` takes `{time}`** and is a tooltip only. It appears on a note whose speech time and typing time differ, which is normal for a note written on a past speech.
- No em dashes. `sb_matrix_legend` is the longest string added and is deliberately three short sentences.

**Verified:** 1000 keys in all four locales, 0 missing / 0 extra, `npx tsc --noEmit` clean, `npx eslint` clean on the touched files.

### 2026-09-05 — conference awards signposts (`feature/conferences-auth`) — 986 → 990 keys

**Added, 4 keys × 4 locales.** `sb_awards_link` sits directly after `sb_export_csv` in the scoreboard cluster; `chair_ended_awards_title` / `chair_ended_awards_body` / `chair_ended_awards_cta` sit directly after `session_hours_until_delete` in the session cluster.

- **Hard gate: every render of these four keys is behind `committee.sessionOrigin === 'conference'`** (`Committee.sessionOrigin`, mapped from `committees.session_origin` in `rowToCommittee`). Awards are a conference feature decided on `/conferences/{slug}/role/chair#awards`; the session only signposts that page and an anonymous standalone session must never show anything award-related. Do not reuse these keys on a surface that is not gated the same way.
- Call sites: `ScoreboardPanel.tsx` header (Awards button, `sb_awards_link`, tooltip `chair_ended_awards_title`); `chair/[code]/page.tsx` `SessionEndedContent` card (title/body/cta) and the small header button beside the scoreboard trophy once the session has ended (`chair_ended_awards_cta`). The href is resolved by `src/lib/sessionAwardsLink.ts`.
- Terminology: awards = ES *premios*, FR *prix*, AR *الجوائز*; the slate/list of winners = ES *lista de premiados*, FR *liste des lauréats*, AR *قائمة الفائزين*; secretariat = ES *secretaría*, FR *secrétariat*, AR *الأمانة العامة*; scoreboard reuses `sb_title` / `chair_hdr_scoreboard` vocabulary (ES *marcador*, FR *tableau des scores*, AR *لوحة النتائج*).
- No placeholders, no `{s}` suffix, no em dashes. The AR strings carry no directional marks.
- `TutorialOverlay.tsx` `SB_COPY` gained an `awardsFoot` sentence in all four locales (inline copy, not a `translations.ts` key, per rule 8). It is deliberately generic because the tutorial does not know the session origin.
- The doc's running count had drifted: the dictionary held 986 keys before this change, not 875. Re-verified with the section A script.

**Verified:** 990 keys in all four locales, 0 missing / 0 extra, `npx tsc --noEmit` clean for the touched files.

### 2026-08-13 — delegate rail micro-labels (`feature/conferences-auth`) — 870 → 875 keys

**Added, 5 keys × 4 locales**, in the delegate cluster alongside the 17 keys from the redesign below (directly after `delegate_docs_sheet_title` in every block): `delegate_roll_call_label`, `delegate_in_the_queue`, `delegate_stat_time_spoken`, `delegate_stat_speeches_given`, `delegate_stat_messages_sent`.

- **These are the two-line variants of the existing one-word stat labels**, not new concepts. Each keeps the root noun of its short sibling so the two sets read as the same thing: `delegate_stat_time_spoken` keeps ES *TIEMPO* / FR *PAROLE* / AR *الوقت*→*وقت*, `delegate_stat_speeches_given` keeps ES *DISCURSOS* / FR *DISCOURS* / AR *الخطابات*, `delegate_stat_messages_sent` keeps ES *MENSAJES* / FR *MESSAGES* / AR *الرسائل*. Never translate one of a pair without the other.
- **Extreme width budget.** These render at 6.5–9px in a narrow rail beside the flag. The three `delegate_stat_*` labels get a ~78–100px column and may wrap to two short lines; `delegate_roll_call_label` and `delegate_in_the_queue` must hold **one line** in ~58–70px. Brevity outranks literalness here — do not "improve" any of these into a fuller phrase.
- **Roll call, per locale, consistent with the rest of the app.** FR **APPEL** and AR **تدقيق الحضور** are exactly what `tab_roll_call` / `feature_rollcall` already use. ES is the deliberate compromise: the full term *lista de asistencia* / *pase de lista* cannot hold one line at this width, so it ships as **ASISTENCIA** — the same short form `tab_roll_call` already uses on the narrow chair tab, so the shortening is not new to the app.
- **`delegate_in_the_queue` is a caption drawn over the delegate's own flag**, under a large ordinal number. Because the ordinal carries the meaning, the caption is abbreviated hard and each locale reuses its existing queue word: ES **EN LA FILA** (matches the former `rollcall_queue` *FILA* and `delegate_no_speakers` *en fila*), FR **EN LISTE** (matches the former `rollcall_queue` *LISTE* and *en liste*), AR **في القائمة** (matches the former `rollcall_queue` *القائمة*). `rollcall_queue` itself was removed on 14 Sep 2026 with the A-Z / QUEUE toggle.
- **MUN register held on the stat labels:** FR *TEMPS DE PAROLE* and *DISCOURS PRONONCÉS* are the standard parliamentary forms; ES *TIEMPO DE PALABRA* and *DISCURSOS PRONUNCIADOS* likewise. ES *DISCURSOS PRONUNCIADOS* is the widest string added (12-char longest word) and was kept only because it wraps to two lines inside the ~78px column.
- No placeholders and **no `{s}` suffix** in any of the five — nothing here is counted or interpolated.
- Uppercase held in the Latin-script locales; AR has no case distinction and uses the normal form. No directional marks or trailing punctuation in the AR strings, so nothing flips under RTL.

**Verified:** 875 keys in all four locales, 0 missing / 0 extra, 0 duplicates within a block.

### 2026-08-13 — redesigned delegate view (`feature/conferences-auth`) — 853 → 870 keys

**Added, 17 keys × 4 locales**, inserted in the delegate cluster directly after `delegate_no_speakers` in every block: `delegate_queue_position_label`, `delegate_speakers_ahead`, `delegate_speaker_ahead_one`, `delegate_eta_about`, `delegate_stat_spoken`, `delegate_stat_speeches`, `delegate_stat_messages`, `delegate_you_chip`, `delegate_speaking_chip`, `delegate_place_saved`, `delegate_not_in_queue`, `delegate_on_deck`, `delegate_full_stats`, `delegate_view_all_queue`, `delegate_floor_now`, `delegate_queue_sheet_title`, `delegate_docs_sheet_title`.

- **No `{s}` suffix.** The speakers-ahead line ships as two keys (`delegate_speakers_ahead` / `delegate_speaker_ahead_one`) chosen by a `=== 1` check at the call site, per the no-plural-engine rule. It does not join the three legacy `{s}` audit exceptions.
- **Each placeholder appears once per string** — `{n}` in the speakers-ahead pair, `{t}` in `delegate_eta_about`. Nothing is reused within a string.
- **`delegate_eta_about` keeps its hedge in every locale** (EN *About …*, ES *Unos …*, FR *Environ …*, AR *نحو …*). `{t}` arrives pre-formatted ("35 min", "1 hr 10 min"), so the sentence is worded to read naturally around an already-built duration. Do not remove the hedge — an unhedged estimate that slips reads as a broken promise.
- **The 3-tile stat strip must not wrap** (~105px per tile on a small phone), so each label is ONE short word in every locale. Two deliberate compromises: ES `delegate_stat_spoken` is **TIEMPO** (time) rather than a literal "hablado", and FR is **PAROLE** (from *temps de parole*) rather than "temps parlé" — both name the duration the tile shows and stay to a single short word. AR uses **الوقت** for the same reason.
- `delegate_stat_speeches` reuses the existing per-locale term for speeches (ES *DISCURSOS*, FR *DISCOURS*, AR *الخطابات*, matching `delegate_speeches_label`).
- `delegate_floor_now` is a small-caps duplicate of the existing `delegate_you_have_floor` copy and carries the same translations in all four locales — the redesign needed a separate key for a differently styled surface.
- **Em dash follows each language's convention** in `delegate_place_saved`: EN keeps the em dash, FR keeps it with spaces, ES uses a colon, AR uses a comma plus *ف*.
- Uppercase held in the Latin-script locales for the small-caps labels (`IN THE SPEAKERS LIST`, `SPOKEN`/`SPEECHES`/`MESSAGES`, `YOU`, `SPEAKING`, `YOU HAVE THE FLOOR`); AR has no case distinction and uses the normal form.
- Terminology held: speakers list = ES *lista de oradores* / FR *liste des orateurs* / AR *قائمة المتحدثين*.

**Verified:** 870 keys in all four locales, 0 missing / 0 extra, 0 duplicates within a block; `npx tsc --noEmit` exit 0.

### 2026-08-07 — delegate score-gap tips (`feature/conferences-auth`) — 864 → 853 keys

**What the tips now mean.** A delegate's Stats tab used to render 5 hardcoded conditionals; it now renders up to **3** tips chosen by `selectDelegateTips()` (`src/lib/delegateTips.ts`) from the delegation's own per-source ledger. Every tip answers "which scoring category are you short on **in this committee**".

- Numbers come from `computeSourceTotals` → `computeLedger` → `getScoringConfig` (`src/lib/scoring.ts`) — pure functions of the committee row, so AGENTS.md rule 14 still holds and the delegate page has **zero** `useSettingsStore` dependency. No scoring maths was reimplemented.
- The selector iterates `cfg.sources.filter(s => s.enabled)`, so a **disabled source can never produce a tip**. It also phase-gates every source, so nothing suggests an action the floor does not currently allow.
- Cold start: below a room-activity floor the selector returns the **onboarding** set (`_mark_present`, `_address`, `_gsl_request`, `_opening`, `_listen`, `_bloc`) instead of gap tips.
- Tips carry no number and no rank, so they survived the removal of every score surface from the delegate view. `delegate_tip_custom_source` names a chair-invented scoring category; it is still surfaced, because a category NAME is guidance rather than a score. (`hideScoresFromDelegates`, which used to gate it, no longer exists; see AGENTS.md.)

**Deleted, 13 keys × 4 locales.** No score source and no feature to hang them on: `delegate_tip_yield`, `_yield_questions` (Gavelling has no yield step), `_point_of_order`, `_point_of_info` (no such motion), `_friendly_amendment`, `_unfriendly_amendment` (no amendment flow), `_impact`, `_close_to_distinguished`, `_distinguished_driver`, `_highest_tier` (copy from the removed tier system), `_help_newer`, `_mentor` (nothing scoreable), `_escalate_dr` (a duplicate of `_have_wp`, which already had the `{wp}` / `{dr}` placeholders).

**Added, 2 keys.** `delegate_tip_custom_source` (`{source}` — a chair-added score source this delegation has none of) and `delegate_tip_all_round` (contributing everywhere; no weakness to name).

**Rewritten, 17 keys — chair-renameable names now interpolate.** Rule 5b applies to tips too, and it applies to **motion** names as well as document names. `{wp}` / `{wps}` / `{dr}` / `{drs}` are filled via `docName()`, and `{mod}` / `{unmod}` / `{tour}` / `{end}` via `motionNames(committee, language)`:
`_no_caucus`, `_caucus_sub`, `_propose_caucus`, `_raise_motion`, `_tdt`, `_closure`, `_coordinate_bloc`, `_unmod_wp`, `_wp_cosponsors`, `_consolidate`, `_lead_dr`, `_passed_dr`, `_legacy`, `_operative_clauses`, `_synthesise`, `_gsl_strategic`, `_have_wp`.

- **Articles are the trap.** A renamed type can be any word in any gender, so "a {wp}" breaks the moment a chair renames Working Paper to "Communiqué" or Unmoderated Caucus to "Breakout". EN keeps a determiner only where "the" works for anything (`the {wp} you sponsor`, `the {drs} on the floor`) or uses the **plural** name to sidestep the article entirely (`co-sponsoring {wps}`). ES/FR/AR drop the article outright, as they already did for `_no_docs` / `_have_wp`.
- `delegate_tip_unmod_wp` takes `{wps}` (plural), not `{wp}` — that was the only way to write the English without an article.
- FR/ES/AR also avoid **adjective agreement** on the substituted noun: `_consolidate` says "qui se font concurrence" / "que compiten entre sí" / "في نص واحد" rather than "concurrents" / "competidoras" / "المتنافسة".
- `_no_caucus` and `_caucus_sub` are filled with whichever caucus motion the chair actually left **enabled** — if Moderated Caucus is switched off they name the Tour de Table instead. Never hardcode `mn.moderated` in a caucus tip.

**Terminology held:** chair = ES *director* / FR *président* / AR *الرئيس*; delegations = *delegaciones* / *délégations* / *الوفود*; GSL = *Lista General de Oradores* / *liste générale* / *القائمة العامة*.

**Verified:** 853 keys in all four locales, 0 missing / 0 extra, **0 duplicate placeholders**; a 60 000-committee randomised sweep renders every one of the 33 surviving keys at least once with **no unfilled `{placeholder}`** in any locale; `npx tsc --noEmit` exit 0; `npm run build` exit 0 (73/73 pages). The only placeholder mismatches remain the three documented legacy `{s}` keys.

### 2026-08-07 — resume-failure copy (`feature/conferences-auth`) — 858 → 864 keys
- The resume-deadlock fix landed five hardcoded English strings on the chair page; all are now keyed and swapped: `session_resume_failed` + `session_resume_failed_locked` (`chair/[code]/page.tsx:2455-2457`), `session_resume_retry` (`:2480`, `:2491`), `session_resume_takeover` (`:2868`) and `session_resume_lost` (`:2516`).
- **`session_resume_takeover` is an all-caps button label in EN/ES/FR only.** AR has no case distinction, so it is written as an ordinary noun phrase (`تولّي الاستئناف`) — never fake emphasis with capitals in Arabic. Same convention as `session_resume_btn`.
- Both failure strings name the Resume button by its own localised label, so ES says "vuelve a pulsar Reanudar", FR "appuyez de nouveau sur Reprendre" and AR "اضغط استئناف الجلسة مجدداً" — matching `session_resume_btn` in each locale rather than transliterating the English word.
- Also keyed **one pre-existing** literal found in the same suspend UI while sweeping: the "Session is suspended, delegates cannot see this view" banner (`chair/[code]/page.tsx:2767`) → `session_suspended_banner`. It predates the resume fix (last touched in `f0d077f`), but it sits in the same overlay and was the only English left there.
- Terminology held: chair = ES *director* / FR *président* / AR *رئيس*; delegates = *delegados* / *délégués* / *المندوبون*.
- Verified: 864 keys in all four locales, 0 missing / 0 extra, 0 duplicate placeholders, `npx tsc --noEmit` exit 0, `npm run build` exit 0 (73/73 pages). The only placeholder mismatches remain the three documented legacy `{s}` keys.


### 2026-08-06 — GavelChip i18n (`feature/conferences-auth`) — 838 → 858 keys
- **`src/components/GavelChip.tsx` was 100% hardcoded English** and is now fully keyed (12 new `gavel_*` keys). The component had no `useT()` at all; it now imports `useT` from `@/contexts/LanguageContext`. Keys: `gavel_you_have_it`, `gavel_chair_offline`, `gavel_take_over`, `gavel_chairing_label`, `gavel_popover_title`, `gavel_explainer_aria`, `gavel_explainer`, `gavel_you`, `gavel_chairing_badge`, `gavel_take_the_gavel`, `gavel_hand_over`, `gavel_footnote`.
  - The offline chip is **two** keys (`gavel_chair_offline` + `gavel_take_over`) because only the second half is bold. Same for `gavel_chairing_label` + the raw `{headChairName}` — a label:value pair, so word order survives every locale including AR.
  - `gavel_you` is stored **without** a leading space (`'(you)'`); the call site renders `` `${' '}${t('gavel_you')}` ``. Do not bake whitespace into the value.
  - The `i` badge glyph itself (`GavelChip.tsx:294`) is left as the literal character — it is a universal info affordance, and its meaning is carried by `aria-label={t('gavel_explainer_aria')}`.
- **`src/app/join/page.tsx` chair role picker keyed** (5 new `join_chair_role_*` keys). `join_chair_role_co_note` also **fixes factually stale copy**: it used to read "you can take the gavel later from Settings", but the Take-the-gavel button was removed from Settings and replaced by a read-only row pointing at the chip. All four locales now name the chip and its position.
- **`src/components/SettingsPanel.tsx` view-only notice keyed** (`settings_view_only`, `settings_view_only_chairing`, `settings_view_only_note`). `settings_view_only_chairing` takes `{name}`; the AR value is `'الجلسة برئاسة {name}'` and the ES value `'Preside {name}'` — the placeholder is positioned by the target language, **not** appended English-style after a translated stem. The ` &middot; ` separator stays as JSX punctuation outside the key.
- **AR position wording stays `أعلى يمين` (top-right)** in both `join_chair_role_co_note` and `settings_head_chair_note`. `GavelChip.tsx:214` anchors the chip with a **physical** `right: '0.85rem'` under `position: fixed`, which `dir="rtl"` does not mirror, so the chip really is on the right in Arabic. If it is ever switched to `insetInlineEnd` (which would also require revisiting the right-aligned `place()` maths at `GavelChip.tsx:114-136`), both strings must flip to `أعلى يسار`.
- Terminology held: ES *director* / *mazo*, FR *président* / *maillet*, AR *الرئيس* / *المطرقة*, consistent with `settings_head_chair_label` / `settings_head_chair_note`. AR reuses the existing dictionary words for caucus (`الحوارات`), motions (`الاقتراحات`) and documents (`المستندات`) inside `gavel_explainer`.
- Verified: 858 keys in all four locales, 0 missing / 0 extra, **0 duplicate placeholders** anywhere in the file, `npx tsc --noEmit` exit 0, `npm run build` exit 0 (73/73 pages).

### 2026-08-06 — i18n loose-ends close-out (`feature/conferences-auth`)
- **`{wp}` / `{dr}` call sites are now wired.** The debt sweep below gave `delegate_tip_no_docs` / `delegate_tip_have_wp` placeholders but could not update the call sites, so delegates were seeing a literal `{wp}` / `{dr}` in the Stats tab. `calcPoints` (`delegate/[code]/page.tsx:157`) now fills them via `docName(committee, …)` with the translated built-in as fallback. Its `t` parameter was widened from `(key: TranslationKey) => string` to the real context signature `(key: TranslationKey, vars?: Record<string, string | number>) => string` — the key-only type could not accept a vars object. Both callers (`:449` and `:482` in `StatisticsTab`) pass the `useT()` value, so they were already compatible. **This was the last outstanding item in the backlog; nothing is left unwired.**
- **Added `settings_head_chair_label` / `settings_head_chair_note`** in all four locales and wired the head-chair row in `SettingsPanel.tsx` (Access tab), which was hardcoded English. The row deliberately stays **outside** the `ReadOnlyRegion on={isViewOnly}` wrapper so a view-only co-chair can still read who is chairing — verified.
- **Arabic direction wording, verified against the DOM, not assumed.** `GavelChip` is anchored `position: fixed` with a **physical** `right: 0.85rem` (`GavelChip.tsx:214`), not a logical inline-end property, so the chip stays on the **right** edge under `dir="rtl"`. The AR note therefore says `أعلى يمين` (top-right), not `أعلى يسار`. If the chip is ever switched to `insetInlineEnd`, this string must flip with it.
- **Fixed a duplicate-`{s}` render bug** in ES/FR `delegate_status_changes_left` — see the interpolation notes at the top. The section A audit script now includes a duplicate-placeholder check.
- Terminology held to the existing per-locale vocabulary: ES *director*, FR *président*, AR *الرئيس* (matching `settings_chair_code_label` / `settings_chair_approval_*`). Gavel is *mazo* / *maillet* / *المطرقة* — first use of the word in the dictionary.

### 2026-08-06 — i18n debt sweep (`feature/conferences-auth`)
- **Added 45 `voting_rules_*` keys** in all four locales, wiring every remaining hardcoded string in `src/components/VotingRulesPanel.tsx` (title, verdict chips, CAST/COUNTED/TO PASS stats, the live sentence, the abstentions line, the three blocked notes, all four section headings, every hover-explainer title+body, the segment labels, the veto note and the three quorum lines). The panel's pre-existing `settings_*` `t()` calls were left untouched.
- **Rewrote `settings_allow_abstentions_note`** in all four locales. The old copy asserted "abstentions are excluded from the denominator", which stopped being true once `abstentionsInDenominator` shipped (`settingsStore.ts:62`, default `false`; enforced at `VotingRulesPanel.tsx:79` as `allowAbstentions === true && abstentionsInDenominator === true`). The note now describes the toggle and names the default instead of asserting fixed behaviour.
- **Deleted 14 dead keys** from all four locales (56 lines), all superseded by `{doc}` variants: `documents_submit_new_wp`, `documents_submit_new_dr`, `documents_empty_wp`, `documents_empty_dr`, `documents_submit_wp_heading`, `documents_submit_dr_heading`, `documents_working_paper_flow`, `documents_dr_flow`, `documents_qa_optional`, `delegate_no_wps`, `delegate_no_drs`, `voting_select_dr`, `voting_next_dr`, `voting_back_drs`.
- **`delegate_tip_no_docs` / `delegate_tip_have_wp`** now take `{wp}` / `{dr}`.
- **`TutorialOverlay`** no longer hardcodes the document names in any locale — `getSteps` takes a resolved `DocLabels`.
