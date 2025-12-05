@echo off
REM Calendar Accuracy Test Suite Runner
REM Runs the comprehensive calendar accuracy test suite

set OUTPUT_FILE=calendar-test-results.txt

echo ========================================
echo Calendar Accuracy Test Suite
echo ========================================
echo.
echo Running: npm run test:calendars
echo Output will be saved to: %OUTPUT_FILE%
echo.

REM Redirect all output (stdout and stderr) to the text file
(
  echo ========================================
  echo Calendar Accuracy Test Suite
  echo ========================================
  echo.
  echo Running: npm run test:calendars
  echo.
  npm run test:calendars
  echo.
  echo ========================================
  echo Test Complete
  echo ========================================
) > "%OUTPUT_FILE%" 2>&1

echo.
echo ========================================
echo Test Complete
echo ========================================
echo Results saved to: %OUTPUT_FILE%
echo.
pause

