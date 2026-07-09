/* Shared UI dictionaries. Display labels only — stored values (junior/middle/
   senior/lead for candidates, capitalized Junior/... for jobs) never change. */

var GRADE_LABELS = {
  intern: 'Стажёр',
  junior: 'Начальный',
  middle: 'Средний',
  senior: 'Продвинутый',
  lead: 'Эксперт',
};

function gradeLabel(g) {
  var k = String(g || '').toLowerCase();
  return GRADE_LABELS[k] || g || '';
}
