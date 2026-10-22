import { describe, it } from 'node:test';
import assert from 'assert';
import * as pdfPageOptions from '../../src/pdf-page-options';
import * as utils from '../../src/utils';

function sampleForm(overrides: Partial<pdfPageOptions.PdfPreviewForm> = {}): pdfPageOptions.PdfPreviewForm {
  return {
    format: 'A4',
    width: '',
    height: '',
    orientation: 'portrait',
    scale: 1,
    displayHeaderFooter: true,
    headerChoice: 'filename-date',
    headerCustom: '',
    footerChoice: 'page-numbers',
    footerCustom: '',
    printBackground: true,
    pageRanges: '',
    marginTop: '1.5cm',
    marginRight: '1cm',
    marginBottom: '1cm',
    marginLeft: '1cm',
    ...overrides,
  };
}

const defaultSettings: pdfPageOptions.PdfPageSettings = {
  format: 'A4',
  width: '',
  height: '',
  orientation: 'portrait',
  scale: 1,
  displayHeaderFooter: true,
  headerTemplate: pdfPageOptions.FILENAME_AND_DATE_HEADER,
  footerTemplate: pdfPageOptions.PAGE_NUMBER_FOOTER,
  printBackground: true,
  pageRanges: '',
  margin: { top: '1.5cm', right: '1cm', bottom: '1cm', left: '1cm' },
};

describe('pdf page options', function () {
  it('should map settings defaults onto the preview form presets', function () {
    const form = pdfPageOptions.settingsToForm(defaultSettings);
    assert.strictEqual(form.format, 'A4');
    assert.strictEqual(form.orientation, 'portrait');
    assert.strictEqual(form.headerChoice, 'filename-date');
    assert.strictEqual(form.headerCustom, '');
    assert.strictEqual(form.footerChoice, 'page-numbers');
    assert.strictEqual(form.footerCustom, '');
    assert.strictEqual(form.marginTop, '1.5cm');
    assert.strictEqual(form.displayHeaderFooter, true);
  });

  it('should treat a blank header as None without changing the footer preset', function () {
    const form = pdfPageOptions.settingsToForm({
      ...defaultSettings,
      headerTemplate: '   ',
    });
    assert.strictEqual(form.headerChoice, 'none');
    assert.strictEqual(form.footerChoice, 'page-numbers');
    const config = pdfPageOptions.formToPdfConfig(form);
    assert.strictEqual(config.headerTemplate, '');
    assert.strictEqual(config.footerTemplate, pdfPageOptions.PAGE_NUMBER_FOOTER);
  });

  it('should keep a custom header when the footer is the page-number preset', function () {
    const custom = '<div>Chapter</div>';
    const form = pdfPageOptions.settingsToForm({
      ...defaultSettings,
      headerTemplate: custom,
    });
    assert.strictEqual(form.headerChoice, 'custom');
    assert.strictEqual(form.headerCustom, custom);
    assert.strictEqual(form.footerChoice, 'page-numbers');
  });

  it('should not clear the footer when the header preset changes', function () {
    const form = sampleForm({
      headerChoice: 'custom',
      headerCustom: '<div>Chapter</div>',
      footerChoice: 'page-numbers',
    });
    const config = pdfPageOptions.formToPdfConfig({ ...form, headerChoice: 'none' });
    assert.strictEqual(config.headerTemplate, '');
    assert.strictEqual(config.footerTemplate, pdfPageOptions.PAGE_NUMBER_FOOTER);
  });

  it('should not clear the header when page numbers are turned off', function () {
    const config = pdfPageOptions.formToPdfConfig(sampleForm({ footerChoice: 'none' }));
    assert.strictEqual(config.headerTemplate, pdfPageOptions.FILENAME_AND_DATE_HEADER);
    assert.strictEqual(config.footerTemplate, '');
  });

  it('should detect the default templates when surrounding whitespace differs', function () {
    const form = pdfPageOptions.settingsToForm({
      ...defaultSettings,
      headerTemplate: '  ' + pdfPageOptions.FILENAME_AND_DATE_HEADER + '  ',
      footerTemplate: '\n' + pdfPageOptions.PAGE_NUMBER_FOOTER + '\n',
    });
    assert.strictEqual(form.headerChoice, 'filename-date');
    assert.strictEqual(form.footerChoice, 'page-numbers');
  });

  it('should let a custom size override the paper format and omit the output path', function () {
    const config = pdfPageOptions.formToPdfConfig(sampleForm({
      format: 'Letter',
      width: '10cm',
      height: '',
    }));
    const pdf = utils.buildPdfOptions(config);
    assert.strictEqual(config.format, 'Letter');
    assert.strictEqual(pdf.format, '');
    assert.strictEqual(pdf.width, '10cm');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(pdf, 'path'), false);
  });

  it('should fall back to scale 1 when the form scale is not positive', function () {
    const config = pdfPageOptions.formToPdfConfig(sampleForm({ scale: 0 }));
    assert.strictEqual(config.scale, 1);
  });

  it('should reject a webview payload that is not a form', function () {
    assert.strictEqual(pdfPageOptions.parsePreviewForm(null), undefined);
    assert.strictEqual(pdfPageOptions.parsePreviewForm({ format: 'A4' }), undefined);
    const parsed = pdfPageOptions.parsePreviewForm(sampleForm({ pageRanges: '1-2' }));
    assert.ok(parsed);
    assert.strictEqual(parsed.pageRanges, '1-2');
    assert.strictEqual(parsed.orientation, 'portrait');
  });

  it('should read missing settings as the export defaults', function () {
    const options = pdfPageOptions.readPdfPageOptions({});
    assert.strictEqual(options.format, 'A4');
    assert.strictEqual(options.orientation, '');
    assert.strictEqual(options.scale, 1);
    assert.strictEqual(options.displayHeaderFooter, true);
    assert.strictEqual(options.printBackground, true);
    assert.deepStrictEqual(options.margin, { top: '', right: '', bottom: '', left: '' });
  });
});
