/**
 * HEXA 유기화학 · 버그 제보용 구글 폼 만들기 (Google Apps Script)
 *
 * 1. https://script.google.com 에 들어가 '새 프로젝트'를 누릅니다.
 * 2. 편집기에 있던 내용을 지우고 이 파일 내용을 모두 붙여넣은 뒤 저장(Ctrl+S)합니다.
 * 3. 위쪽 함수 목록이 createHexaBugForm 인지 보고 ▶ 실행 을 누릅니다. 권한 창이 뜨면 계정을 고르고
 *    '고급' → '(안전하지 않은 페이지)로 이동' → '허용'. 직접 만든 스크립트라 이렇게 뜹니다.
 * 4. 아래 '실행 로그'의 ▶ HEXA 로 시작하는 줄을 복사해서 Claude 에게 보내 주세요.
 *
 * 만들어지는 것: 구글 폼 'HEXA 유기화학 버그 제보' + 응답이 쌓이는 스프레드시트 (내 드라이브).
 * 이메일은 모으지 않고, 로그인 없이 제출할 수 있습니다.
 * 사이트의 '제보' 창에서 보내면 페이지 · 분자 · 반응 결과 · 기기 정보가 자동으로 채워집니다.
 */
/* 사이트(js/report.js)의 KINDS 와 글자까지 같아야 한다 */
var KINDS = ['이름이 틀려요', '반응 결과가 이상해요', '그림 · 3D 가 이상해요', '버튼 · 화면 오류', '느려요 · 렉', '제안 · 기타'];

function createHexaBugForm() {
  var form = FormApp.create('HEXA 유기화학 버그 제보');
  form.setDescription('틀린 이름, 이상한 반응 결과, 깨진 화면을 알려 주세요. 보낸 내용은 사이트 운영자만 볼 수 있어요.\n사이트 아래쪽 \'제보\' 버튼으로 보내면 보던 분자 · 화면 정보가 자동으로 채워져요.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('고마워요! 확인하고 고칠게요.');
  try { form.setRequireLogin(false); } catch (e) { /* 개인 계정은 원래 로그인 없이 제출 */ }

  var kind = form.addMultipleChoiceItem().setTitle('어떤 문제인가요?').setChoiceValues(KINDS);
  var what = form.addParagraphTextItem().setTitle('무엇이 이상한가요?').setHelpText('예: "○○ 에 CH₃ 를 붙였더니 이름이 △△ 로 나오는데 □□ 가 맞는 것 같아요"').setRequired(true);
  var who = form.addTextItem().setTitle('답을 받을 이름 · 연락처 (선택)');
  var ctx = form.addParagraphTextItem().setTitle('화면 정보').setHelpText('사이트에서 보내면 자동으로 채워져요 (페이지, 분자 SMILES · 이름, 반응 결과, 기기).');

  try { form.setPublished(true); } catch (e) { /* 게시 설정이 없는 계정은 이미 게시 상태 */ }
  form.setAcceptingResponses(true);

  var sheet = SpreadsheetApp.create('HEXA 유기화학 버그 제보 (응답)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  /* 미리 채운 주소에서 사이트가 쓸 칸 번호(entry)를 알 수 있다 */
  var r = form.createResponse()
    .withItemResponse(kind.createResponse(KINDS[0]))
    .withItemResponse(what.createResponse('WHAT'))
    .withItemResponse(who.createResponse('WHO'))
    .withItemResponse(ctx.createResponse('CTX'));

  Logger.log('▶ HEXA ' + r.toPrefilledUrl());
  Logger.log('응답 스프레드시트: ' + sheet.getUrl());
  Logger.log('폼 고치기: ' + form.getEditUrl());
}
