CREATE VIEW unsupported_analysis AS
WITH cte AS (SELECT * FROM customers)
SELECT UPPER(email) AS normalized_email FROM cte;
