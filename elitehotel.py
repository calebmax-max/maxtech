import pandas as pd

df = pd.read_csv("elitehotel_site_data.csv")

def get_bot_response(user_text):
    user_text = user_text.lower()

    for index, row in df.iterrows():
        keywords_list = str(row['Keywords']).split(',')

        for word in keywords_list:
            if word.strip().lower() in user_text:
                return row["Response"]

    return "Sorry, I don't understand that yet."